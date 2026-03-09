#!/bin/bash

cd "$(dirname "$0")"

# Load credentials
source .env.credentials

if [ -z "$IP" ] || [ -z "$USER" ] || [ -z "$PASSWORD" ]; then
  echo "Error: Missing credentials in .env.credentials"
  echo "Required: IP, USER, PASSWORD"
  exit 1
fi

REMOTE_DIR="${REMOTE_DIR:-/root/agite}"

# Helper: run command on remote server via sshpass
remote() {
  sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$USER@$IP" "$1"
}

remote_upload() {
  sshpass -p "$PASSWORD" rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '*.db' --exclude '.env.credentials' -e "ssh -o StrictHostKeyChecking=no" "$1" "$USER@$IP:$2"
}

# Check sshpass is installed
if ! command -v sshpass &> /dev/null; then
  echo "sshpass not found. Installing..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install hudochenkov/sshpass/sshpass
  else
    sudo apt-get install -y sshpass
  fi
fi

echo "========================================="
echo "  Agite Deploy Script"
echo "========================================="
echo ""
echo "Server: $USER@$IP"
echo "Remote: $REMOTE_DIR"
echo ""

# Step 1: Test SSH connection
echo "[1/7] Testing SSH connection..."
if ! remote "echo 'Connected'" 2>/dev/null; then
  echo "Error: Cannot connect to $USER@$IP"
  exit 1
fi
echo "  OK"

# Step 2: Check existing PM2 processes
echo "[2/7] Checking existing PM2 processes..."
EXISTING_PM2=$(remote "pm2 jlist 2>/dev/null || echo '[]'")
echo "$EXISTING_PM2" | python3 -c "
import sys, json
try:
    apps = json.load(sys.stdin)
    if not apps:
        print('  No existing PM2 processes')
    else:
        print(f'  Found {len(apps)} existing PM2 process(es):')
        for app in apps:
            name = app.get('name', '?')
            port = app.get('pm2_env', {}).get('PORT', app.get('pm2_env', {}).get('env', {}).get('PORT', '?'))
            status = app.get('pm2_env', {}).get('status', '?')
            print(f'    - {name} (port {port}) [{status}]')
except:
    print('  Could not parse PM2 list')
"

# Step 3: Install Node.js and PM2 if needed
echo "[3/7] Checking server dependencies..."
remote "
  # Install Node.js if not present
  if ! command -v node &> /dev/null; then
    echo '  Installing Node.js...'
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  echo \"  Node: \$(node -v)\"

  # Install PM2 if not present
  if ! command -v pm2 &> /dev/null; then
    echo '  Installing PM2...'
    npm install -g pm2
  fi
  echo \"  PM2: \$(pm2 -v)\"

  # Create project directory
  mkdir -p $REMOTE_DIR
"

# Step 4: Find 3 consecutive available ports (skip ports used by ANY process including other PM2 apps)
echo "[4/7] Finding 3 consecutive available ports..."
PORTS=$(remote "
  # Collect all ports in use (listening TCP)
  USED_PORTS=\$(ss -tlnp 2>/dev/null | awk '{print \$4}' | grep -oE '[0-9]+$' | sort -un)

  is_free() {
    echo \"\$USED_PORTS\" | grep -qx \"\$1\" && return 1
    return 0
  }

  for START_PORT in \$(seq 4000 1 9000); do
    PORT1=\$START_PORT
    PORT2=\$((START_PORT + 1))
    PORT3=\$((START_PORT + 2))

    if is_free \$PORT1 && is_free \$PORT2 && is_free \$PORT3; then
      echo \"\$PORT1 \$PORT2 \$PORT3\"
      exit 0
    fi
  done
  echo 'NONE'
")

if [ "$PORTS" = "NONE" ]; then
  echo "Error: Could not find 3 consecutive available ports"
  exit 1
fi

BACKEND_PORT=$(echo $PORTS | awk '{print $1}')
FRONTEND_PORT=$(echo $PORTS | awk '{print $2}')
ADMIN_PORT=$(echo $PORTS | awk '{print $3}')

echo "  Backend:  port $BACKEND_PORT"
echo "  Frontend: port $FRONTEND_PORT"
echo "  Admin:    port $ADMIN_PORT"

# Step 5: Upload project files
echo "[5/7] Uploading project files..."
remote_upload "./" "$REMOTE_DIR/"
echo "  Done"

# Step 6: Generate configs with discovered ports
echo "[6/7] Configuring services on server..."
remote "
  cd $REMOTE_DIR

  # Update backend .env with the assigned port
  cat > backend/.env << ENVEOF
PORT=$BACKEND_PORT
JWT_SECRET=agite-secret-key-change-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ENVEOF

  # Generate ecosystem.config.js with discovered ports
  cat > ecosystem.config.js << 'JSEOF'
module.exports = {
  apps: [
    {
      name: 'agite-backend',
      cwd: './backend',
      script: 'server.js',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: $BACKEND_PORT,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
    {
      name: 'agite-frontend',
      cwd: './frontend',
      script: 'npx',
      args: 'react-scripts start',
      exec_mode: 'fork',
      interpreter: 'none',
      env: {
        HOST: '0.0.0.0',
        PORT: $FRONTEND_PORT,
        BROWSER: 'none',
        CI: 'true',
        DANGEROUSLY_DISABLE_HOST_CHECK: 'true',
        REACT_APP_API_URL: 'http://$IP:$BACKEND_PORT/api',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
    {
      name: 'agite-admin',
      cwd: './admin-frontend',
      script: 'npx',
      args: 'react-scripts start',
      exec_mode: 'fork',
      interpreter: 'none',
      env: {
        HOST: '0.0.0.0',
        PORT: $ADMIN_PORT,
        BROWSER: 'none',
        CI: 'true',
        DANGEROUSLY_DISABLE_HOST_CHECK: 'true',
        REACT_APP_API_URL: 'http://$IP:$BACKEND_PORT/api',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
JSEOF

  # Replace shell variables in the JS file
  sed -i \"s|\\\$BACKEND_PORT|$BACKEND_PORT|g\" ecosystem.config.js
  sed -i \"s|\\\$FRONTEND_PORT|$FRONTEND_PORT|g\" ecosystem.config.js
  sed -i \"s|\\\$ADMIN_PORT|$ADMIN_PORT|g\" ecosystem.config.js
  sed -i \"s|\\\$IP|$IP|g\" ecosystem.config.js

  # Install dependencies
  echo '  Installing backend dependencies...'
  cd backend && npm install --production && cd ..
  echo '  Installing frontend dependencies...'
  cd frontend && npm install && cd ..
  echo '  Installing admin dependencies...'
  cd admin-frontend && npm install && cd ..
"

# Step 7: Start ONLY agite services (do NOT touch other PM2 processes)
echo "[7/7] Starting agite services (other PM2 apps untouched)..."
remote "
  cd $REMOTE_DIR

  # Only stop/delete agite processes — leave everything else running
  pm2 delete agite-backend 2>/dev/null
  pm2 delete agite-frontend 2>/dev/null
  pm2 delete agite-admin 2>/dev/null

  # Start agite services
  pm2 start ecosystem.config.js

  # Save ALL PM2 processes (including other apps) for auto-restart on reboot
  pm2 save

  # Setup PM2 startup script (idempotent)
  pm2 startup 2>/dev/null

  echo ''
  echo 'All PM2 processes:'
  pm2 status
"

echo ""
echo "========================================="
echo "  Agite deployed successfully!"
echo "========================================="
echo ""
echo "  Frontend:  http://$IP:$FRONTEND_PORT"
echo "  Admin:     http://$IP:$ADMIN_PORT"
echo "  Backend:   http://$IP:$BACKEND_PORT"
echo ""
echo "  Other PM2 processes were NOT touched."
echo ""
echo "  SSH in:    sshpass -p '$PASSWORD' ssh $USER@$IP"
echo "  Logs:      pm2 logs agite-backend"
echo "========================================="

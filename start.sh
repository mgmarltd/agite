#!/bin/bash

cd "$(dirname "$0")"

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "pm2 not found. Installing globally..."
  npm install -g pm2
fi

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd frontend && npm install && cd ..
fi

if [ ! -d "admin-frontend/node_modules" ]; then
  echo "Installing admin-frontend dependencies..."
  cd admin-frontend && npm install && cd ..
fi

# Kill any existing processes on our ports
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5000 | xargs kill -9 2>/dev/null

# Stop any existing pm2 processes for this project
pm2 delete agite-backend agite-frontend agite-admin 2>/dev/null

# Start all services
pm2 start ecosystem.config.js

# Show status
pm2 status

echo ""
echo "========================================="
echo "  Agite is running!"
echo "========================================="
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Admin:     http://localhost:3001"
echo "  Backend:   http://localhost:5000"
echo ""
echo "  Commands:"
echo "    pm2 logs               - View all logs"
echo "    pm2 logs agite-backend  - Backend logs"
echo "    pm2 logs agite-frontend - Frontend logs"
echo "    pm2 logs agite-admin    - Admin logs"
echo "    pm2 stop all            - Stop all"
echo "    pm2 restart all         - Restart all"
echo "    pm2 delete all          - Remove all"
echo "========================================="

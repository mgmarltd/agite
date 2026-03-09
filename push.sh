#!/bin/bash

cd "$(dirname "$0")"

# Initialize git repo if needed
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init
fi

# Ensure .gitignore exists
if [ ! -f ".gitignore" ]; then
  cat > .gitignore << 'EOF'
node_modules/
*.db
.env
.env.credentials
.DS_Store
build/
EOF
  echo "Created .gitignore"
fi

# Set remote origin
REMOTE_URL="https://github.com/mgmarltd/agite.git"
CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null)

if [ -z "$CURRENT_REMOTE" ]; then
  git remote add origin "$REMOTE_URL"
  echo "Remote origin set to $REMOTE_URL"
elif [ "$CURRENT_REMOTE" != "$REMOTE_URL" ]; then
  git remote set-url origin "$REMOTE_URL"
  echo "Remote origin updated to $REMOTE_URL"
fi

# Show status
echo ""
echo "Changes:"
echo "--------"
git status --short
echo ""

# Ask for commit message
read -p "Commit message: " COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
  echo "Error: Commit message cannot be empty"
  exit 1
fi

# Stage, commit, push
git add -A
git commit -m "$COMMIT_MSG"

# Push (set upstream on first push)
BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
if [ -z "$BRANCH" ]; then
  BRANCH="main"
  git checkout -b main
fi

git push -u origin "$BRANCH"

echo ""
echo "Pushed to $REMOTE_URL ($BRANCH)"

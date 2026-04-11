#!/bin/bash
# ============================================================
#  3D Tech — Production Deployment Script
#  Usage:  bash deploy.sh [--fresh]
#    --fresh  : Full fresh install (npm ci + build + pm2 restart)
#    (default): Quick deploy (git pull + build + pm2 reload)
# ============================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="3dtech"
NODE_MIN="20"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------- Pre-flight checks ----------

# Node.js version
NODE_VER=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VER" ] || [ "$NODE_VER" -lt "$NODE_MIN" ]; then
  error "Node.js >= $NODE_MIN required. Current: $(node -v 2>/dev/null || echo 'not installed')"
fi
log "Node.js $(node -v) OK"

# PM2
if ! command -v pm2 &>/dev/null; then
  error "PM2 not found. Install: npm install -g pm2"
fi
log "PM2 $(pm2 -v) OK"

# .env file
if [ ! -f "$APP_DIR/.env" ]; then
  error ".env file not found! Create it first:\n  cp .env.example .env && nano .env"
fi
log ".env file found"

# Check JWT_SECRET is set
if ! grep -q "^JWT_SECRET=" "$APP_DIR/.env" || grep -q "^JWT_SECRET=$" "$APP_DIR/.env"; then
  warn "JWT_SECRET is empty or missing in .env — using default (NOT SAFE for production!)"
fi

cd "$APP_DIR"

# ---------- Deploy ----------

FRESH=false
if [ "${1:-}" = "--fresh" ]; then
  FRESH=true
fi

# Step 1: Pull latest code (if git repo)
if [ -d .git ]; then
  log "Pulling latest code..."
  git pull --ff-only || warn "Git pull failed — continuing with current code"
fi

# Step 2: Install dependencies
if [ "$FRESH" = true ]; then
  log "Fresh install — running npm ci..."
  npm ci --omit=dev
else
  log "Installing dependencies..."
  npm install --omit=dev
fi

# Step 3: Build frontend
log "Building frontend..."
npm run build

# Step 4: Ensure required directories exist
mkdir -p "$APP_DIR/server/backups"
mkdir -p "$APP_DIR/server/uploads"

# Step 5: Start/Restart PM2
if pm2 describe "$APP_NAME" &>/dev/null; then
  if [ "$FRESH" = true ]; then
    log "Restarting PM2 processes..."
    pm2 restart ecosystem.config.cjs
  else
    log "Reloading PM2 (zero-downtime)..."
    pm2 reload ecosystem.config.cjs
  fi
else
  log "Starting PM2 processes..."
  pm2 start ecosystem.config.cjs
fi

# Step 6: Save PM2 process list (survives reboot)
pm2 save

log "========================================"
log "  Deployment complete!"
log "  App: http://localhost:${PORT:-3001}"
log "  PM2: pm2 status / pm2 logs $APP_NAME"
log "========================================"

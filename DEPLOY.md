# 3D Tech — Production Deployment Guide

## Prerequisites

- **VPS**: Ubuntu 22.04+ (Hostinger, DigitalOcean, etc.)
- **Domain**: Pointed to your VPS IP (A record)
- **SSH access**: `ssh root@YOUR_VPS_IP`

---

## Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Verify
node -v    # v20.x
pm2 -v     # 5.x
nginx -v   # 1.x
```

## Step 2: Deploy Application

### Option A: Git Clone (Recommended)

```bash
cd /var/www
git clone YOUR_REPO_URL 3dtech
cd 3dtech
```

### Option B: Upload via SCP

```bash
# From your local machine:
scp -r . root@YOUR_VPS_IP:/var/www/3dtech/
```

## Step 3: Configure Environment

```bash
cd /var/www/3dtech

# Create .env from template
cp .env.example .env

# Generate a strong JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Edit .env with your values
nano .env
```

**Required .env values:**

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Random 128-char hex string (generated above) |
| `PORT` | 3001 (default) |
| `NODE_ENV` | production |
| `CORS_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` |

## Step 4: Install & Build

```bash
# Quick deploy (installs deps, builds frontend, starts PM2)
bash deploy.sh --fresh

# Or manually:
npm install --omit=dev
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # Auto-start on reboot
```

## Step 5: Configure Nginx

```bash
# Copy the included nginx config
sudo cp nginx.conf /etc/nginx/sites-available/3dtech

# Edit — replace "yourdomain.com" with your actual domain
sudo nano /etc/nginx/sites-available/3dtech

# Enable the site
sudo ln -s /etc/nginx/sites-available/3dtech /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test & reload
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: SSL Certificate (Free)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (auto-configures Nginx)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically. Test it:
sudo certbot renew --dry-run
```

## Step 7: Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## Daily Operations

### Monitor
```bash
pm2 status              # Process status
pm2 logs 3dtech         # Live logs
pm2 monit               # CPU/Memory dashboard
curl localhost:3001/api/health   # Health check
```

### Update / Redeploy
```bash
cd /var/www/3dtech
bash deploy.sh          # Pull, build, zero-downtime reload
```

### Backup
```bash
# Manual backup
pm2 start 3dtech-backup   # Runs once and stops

# Automatic: PM2 runs backup daily at 2:00 AM
# Backups stored in: server/backups/ (last 30 kept)
```

### Logs
```bash
# PM2 logs
pm2 logs 3dtech --lines 100
pm2 flush               # Clear log files

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## Architecture

```
Internet
    |
  Nginx (port 80/443)  ─── SSL termination, gzip, static cache
    |
  Express (port 3001)  ─── API + serves built frontend
    |
  SQLite (data.db)      ─── WAL mode, auto-backup via PM2 cron
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Site not loading | `pm2 status` — check if app is running |
| 502 Bad Gateway | Express crashed — `pm2 logs 3dtech` for errors |
| Can't login | Check `JWT_SECRET` in .env matches what was used to create tokens |
| Upload fails | Check `server/uploads/` permissions: `chmod 755 server/uploads` |
| DB locked | Check no stale processes: `pm2 delete all && pm2 start ecosystem.config.cjs` |
| Memory issues | `pm2 restart 3dtech` (auto-restarts at 256MB) |

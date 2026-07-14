# STEP 1 - Copy this file, rename to server-setup.ps1 and fill in credentials
# This template file is safe to commit. The actual server-setup.ps1 is gitignored.

$SERVER_IP   = "YOUR_SERVER_IP"
$SERVER_USER = "root"
$SERVER_PASS = "YOUR_PASSWORD_HERE"   # <-- fill in before running (do not commit)
$REPO_URL    = "https://github.com/AkilaEranda8/mobile-shop.git"
$APP_DIR     = "/opt/hexalyte"

Write-Host @"

Run these commands in order:

1. SSH into server:
   ssh root@$SERVER_IP

2. On the server, run:
   apt update -y
   apt install -y docker.io docker-compose-plugin git curl
   systemctl enable docker
   systemctl start docker

3. Clone repo:
   mkdir -p $APP_DIR
   cd $APP_DIR
   git clone $REPO_URL .

4. Create root .env from template (REQUIRED — secrets live only here):
   cp .env.example .env
   nano .env
   # Set strong POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET,
   # NEXTAUTH_SECRET, KC_CLIENT_SECRET, DATABASE_URL, REDIS_URL
   chmod 600 .env

5. Start all services:
   docker compose up -d --build

6. Run migrations:
   docker compose exec backend npx prisma migrate deploy

"@ -ForegroundColor Cyan

Write-Host "Server IP: $SERVER_IP" -ForegroundColor Green
Write-Host "After setup, check: https://app.hexalyte.com" -ForegroundColor Yellow

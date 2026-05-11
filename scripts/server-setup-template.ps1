# STEP 1 - Copy this file, rename to server-setup.ps1 and fill in credentials
# This template file is safe to commit. The actual server-setup.ps1 is gitignored.

$SERVER_IP   = "49.12.207.238"
$SERVER_USER = "root"
$SERVER_PASS = "YOUR_PASSWORD_HERE"   # <-- fill in before running
$REPO_URL    = "https://github.com/AkilaEranda8/mobile-shop.git"
$APP_DIR     = "/opt/hexalyte"

# Install sshpass-equivalent using plink (PuTTY) or run manually
# Recommended: run these commands manually in terminal

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

4. Create backend .env:
   cat > apps/backend/.env << 'EOF'
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=postgresql://hexalyte:hexalyte_secret@postgres:5432/hexalyte
   REDIS_URL=redis://redis:6379
   JWT_SECRET=hexalyte-super-secret-jwt-key-change-in-production
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   FRONTEND_URL=http://$SERVER_IP:3000
   API_PREFIX=api/v1
   KEYCLOAK_URL=http://keycloak:8080
   KC_REALM=hexalyte
   KC_CLIENT_ID=hexalyte-backend
   KC_CLIENT_SECRET=MTn88PrnUswYgydsveQZumTX2lzqkbbg
   KEYCLOAK_AUTH_ENABLED=false
   EOF

5. Start all services:
   docker compose up -d --build

6. Run migrations:
   docker compose exec backend npx prisma migrate deploy

"@ -ForegroundColor Cyan

Write-Host "Server IP: $SERVER_IP" -ForegroundColor Green
Write-Host "After setup, check: http://${SERVER_IP}:3000" -ForegroundColor Yellow

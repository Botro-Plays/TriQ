# TriQ — Infrastructure & VPS Deployment (Actual)

## VPS Specifications
| Resource | Value |
|----------|-------|
| **Provider** | User's spare VPS |
| **Public IP** | `72.51.57.201` |
| **Domain** | `triq.dpdns.org` |
| **CPU** | 8 vCPU |
| **RAM** | 16 GB |
| **Storage** | 80 GB NVMe SSD |
| **OS** | Ubuntu Server 24.04 LTS amd64 |

This is **more than sufficient** for launch and moderate growth.

---

## 1. OS Setup (Ubuntu 24.04)

### Initial Server Hardening
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Create non-root user
sudo adduser triq
sudo usermod -aG sudo triq

# Enable UFW firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Set timezone to Asia/Manila
sudo timedatectl set-timezone Asia/Manila
```

### Install Core Dependencies
```bash
# Node.js (LTS v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # Should show v20.x.x
npm -v

# Nginx
sudo apt install -y nginx

# MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# PM2 (Node.js process manager)
sudo npm install -g pm2
pm2 startup systemd

# Git
sudo apt install -y git
git --version
```

---

## 2. MySQL Database Setup

```bash
# Login as root
sudo mysql

# Create database and user
CREATE DATABASE triq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'triq'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON triq_db.* TO 'triq'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**Important**: If the password contains special characters (`@`, `%`, `!`), URL-encode them in `DATABASE_URL`:
```
DATABASE_URL=mysql://triq:password%40%21@localhost:3306/triq_db
```

---

## 3. Directory Structure

```
/var/www/
├── triq/                    # Frontend static files (from web build)
│   ├── index.html
│   ├── assets/
│   └── ...
├── triq-server/             # Backend code
│   ├── dist/                # Compiled server
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/      # SQL migration files
│   ├── config/              # Firebase service account JSON
│   │   └── triq-35908-firebase-adminsdk-....json
│   ├── package.json
│   └── .env                 # NOT in git — manually created
└── web/
    └── dist/ -> /var/www/triq/   # Symlink for server static serving
```

---

## 4. Nginx Configuration

`/etc/nginx/sites-available/triq.dpdns.org`:
```nginx
server {
    listen 80;
    server_name triq.dpdns.org;

    # Frontend static files
    location / {
        root /var/www/triq;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.io WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/triq.dpdns.org /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 5. SSL / HTTPS (Cloudflare)

We use **Cloudflare** for SSL — no Let's Encrypt needed on the VPS.

1. Add `triq.dpdns.org` A record → `72.51.57.201` in Cloudflare DNS
2. Set SSL/TLS mode to **Flexible**
3. Enable **Proxied** (orange cloud)

**Important**: Disable IPv6 on the VPS if Cloudflare returns 521 errors:
```bash
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=1
```

---

## 6. PM2 Process Management

```bash
# Start server with PM2
pm2 start /var/www/triq-server/dist/index.js --name triq-server

# Save PM2 config to auto-start on boot
pm2 save --force
pm2 startup systemd

# Useful commands
pm2 list                    # Show running processes
pm2 logs triq-server        # View logs
pm2 restart triq-server   # Restart
pm2 stop triq-server       # Stop
pm2 delete triq-server     # Remove
```

---

## 7. Environment Variables

Create `/var/www/triq-server/.env`:
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=mysql://triq:password@localhost:3306/triq_db
JWT_SECRET=your_random_64_char_string
WEB_APP_URL=https://triq.dpdns.org
FIREBASE_PROJECT_ID=triq-35908
FIREBASE_SERVICE_ACCOUNT_PATH=./config/triq-35908-firebase-adminsdk-fbsvc-7756d8a28a.json
```

**Generate JWT secret** (Node.js):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

---

## 8. Backup Strategy

### MySQL Backups
```bash
# Daily automated backup via cron
crontab -e
# Add: 0 2 * * * mysqldump -u triq -p'password' triq_db | gzip > /backups/triq-$(date +\%Y\%m\%d).sql.gz

# Retain 30 days
0 3 * * * find /backups -name "*.sql.gz" -mtime +30 -delete
```

### What to Backup
| Data | Frequency | Destination |
|------|-----------|-------------|
| MySQL DB | Daily | VPS local + optional remote |
| `config/` (Firebase JSON) | Once | Copy to local safe storage |
| `.env` | Once | Copy to password manager |
| Application code | Every deploy | GitHub is source of truth |

---

## 9. Monitoring

| Tool | Purpose | Cost |
|------|---------|------|
| `pm2 logs` | Application logs | Free |
| `pm2 monit` | Real-time process monitor | Free |
| Nginx access logs | Request tracking | Free |
| `htop` / `free -h` | Resource monitoring | Free |
| Cloudflare Analytics | Traffic + security | Free |
| Uptime Kuma (future) | Uptime monitoring | Free |

---

## 10. Troubleshooting

### Cloudflare 521 (Web Server Down)
- Check IPv6 is disabled: `curl -s ifconfig.me` should show IPv4
- Check nginx: `sudo systemctl status nginx`
- Check server: `pm2 list`

### Database Connection Errors
- Verify `.env` `DATABASE_URL` is correct
- Check MySQL user permissions: `SHOW GRANTS FOR 'triq'@'localhost';`
- Check MySQL running: `sudo systemctl status mysql`

### Prisma Migration Failures
- Ensure `prisma/migrations/` exists in deployed code
- Run manually: `npx prisma migrate deploy`
- Check shadow database permissions if `migrate dev` fails

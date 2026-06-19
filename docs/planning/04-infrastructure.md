# TriQ — Infrastructure & VPS Deployment Plan

## VPS Specifications
| Resource | Value |
|----------|-------|
| **Provider** | User's spare VPS |
| **Public IP** | `72.51.57.201` |
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
# Docker (Ubuntu 24.04 Noble)
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y

# Add Docker GPG key (legacy method, works reliably on Noble)
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 7EA0A9C3F273FCD8

# Add Docker repo
echo "deb [arch=amd64] https://download.docker.com/linux/ubuntu noble stable" | sudo tee /etc/apt/sources.list.d/docker.list

# Update and install Docker
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y

# Add user to docker group
sudo usermod -aG docker triq

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# IMPORTANT: Log out and SSH back in before running docker without sudo

# Node.js (LTS v20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # Should show v20.x.x
npm -v

# Git
sudo apt install git -y
git --version
```

---

## 2. Docker Compose Stack

All services run as containers via `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build: ./backend
    container_name: triq-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://triq:${DB_PASSWORD}@postgres:5432/triq?schema=public
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
      - PAYMONGO_SECRET_KEY=${PAYMONGO_SECRET_KEY}
    depends_on:
      - postgres
      - redis
    networks:
      - triq-network

  postgres:
    image: postgis/postgis:16-3.4
    container_name: triq-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=triq
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=triq
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - triq-network

  redis:
    image: redis:7-alpine
    container_name: triq-redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
    ports:
      - "127.0.0.1:6379:6379"
    networks:
      - triq-network

  nginx:
    image: nginx:alpine
    container_name: triq-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./landing-page/dist:/usr/share/nginx/html:ro
      - ./web-passenger/dist:/usr/share/nginx/html/web:ro
      - ./admin-dashboard/dist:/usr/share/nginx/html/admin:ro
    depends_on:
      - api
    networks:
      - triq-network

volumes:
  postgres-data:
  redis-data:

networks:
  triq-network:
    driver: bridge
```

### Estimated Memory Usage at Idle
| Service | Estimated RAM |
|---------|--------------|
| Node.js API | 512 MB - 1 GB |
| PostgreSQL + PostGIS | 1.5 - 2 GB |
| Redis | 256 - 512 MB |
| Nginx | 128 - 256 MB |
| **Total** | **~2.5 - 4 GB** |
| **Available Headroom** | **~12 GB** |

**Note**: Landing page and web passenger app are static builds served by Nginx — near-zero extra memory.

---

## 3. Nginx Reverse Proxy Configuration

### `nginx.conf` (simplified)
```nginx
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3001;
    }

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    server {
        listen 80;
        server_name api.triq.app;  # or IP for now
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.triq.app;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # API proxy
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_cache_bypass $http_upgrade;
        }

        # Socket.io WebSocket support
        location /socket.io/ {
            proxy_pass http://api/socket.io/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400;
        }

        # Web Passenger App (PWA)
        location /web/ {
            alias /usr/share/nginx/html/web/;
            try_files $uri $uri/ /web/index.html;
            # PWA: allow service worker and manifest
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|json)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # Admin dashboard static files
        location /admin/ {
            alias /usr/share/nginx/html/admin/;
            try_files $uri $uri/ /admin/index.html;
        }

        # Landing Page (root domain)
        location / {
            alias /usr/share/nginx/html/;
            try_files $uri $uri/ /index.html;
        }
    }
}
```

---

## 4. SSL / HTTPS (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate (replace with actual domain when ready)
sudo certbot --nginx -d api.triq.app -d admin.triq.app

# Auto-renewal is set up by default, test with:
sudo certbot renew --dry-run
```

**If no domain yet**: Use IP + self-signed cert or get a free subdomain from `nip.io` or `duckdns.org`.

---

## 5. CI/CD & Deployment Flow

### Local Development → VPS
```
Developer machine
       │
       ▼
  Git push to GitHub
       │
       ▼
  SSH into VPS
       │
       ▼
  git pull origin main
       │
       ▼
  docker compose down && docker compose up -d --build
       │
       ▼
  Prisma migrate deploy
       │
       ▼
  Live on 72.51.57.201
```

### Future: GitHub Actions (optional)
- Auto-deploy on push to `main` branch
- Run tests before deploy
- Build and push Docker image to GitHub Container Registry

---

## 6. Backup Strategy

### PostgreSQL Backups
```bash
# Daily automated backup via cron
crontab -e
# Add: 0 2 * * * docker exec triq-postgres pg_dump -U triq triq | gzip > /backups/triq-$(date +\%Y\%m\%d).sql.gz
```

### What to Backup
| Data | Frequency | Destination |
|------|-----------|-------------|
| PostgreSQL DB | Daily | VPS local + remote (optional rclone to GDrive) |
| Redis (sessions) | Optional | Rebuilds from DB on restart |
| Nginx SSL certs | On change | Certbot auto-renews |
| Application code | Every deploy | GitHub is source of truth |

---

## 7. Monitoring (Future / MVP+)

| Tool | Purpose | Cost |
|------|---------|------|
| `docker stats` + `htop` | Basic resource monitoring | Free |
| Nginx access logs | Request tracking | Free |
| Pino logs (JSON) | Structured API logging | Free |
| Uptime Kuma (self-hosted) | Uptime monitoring | Free |
| Grafana + Prometheus (future) | Detailed metrics | Free |

---

## 8. Domain & DNS (Future)

| Subdomain | Purpose |
|-----------|---------|
| `api.triq.app` | Backend API + Socket.io |
| `admin.triq.app` | Admin dashboard |
| `triq.app` | Landing page / marketing |

**If no budget for domain yet**: Use the raw IP `72.51.57.201` with self-signed SSL or DuckDNS free subdomain.

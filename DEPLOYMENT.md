# Portainer Deployment Guide

## Quick Start

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd Supports
```

### 2. Set Environment Variables

Create a `.env` file in the root directory (or configure in Portainer):

```env
# JWT Secret (REQUIRED - Generate a strong random secret)
JWT_SECRET=your-super-secret-jwt-key-change-this

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com

# SMTP Configuration (Optional - for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
```

### 3. Deploy with Docker Compose

#### Option A: Local Testing
```bash
docker-compose up -d
```

#### Option B: Portainer Deployment

1. Log into your Portainer instance
2. Go to **Stacks** → **Add Stack**
3. Name: `it-support-system`
4. Build method: **Repository**
5. Repository URL: `<your-git-repo-url>`
6. Compose path: `docker-compose.yml`
7. Add environment variables (JWT_SECRET, etc.)
8. Deploy

### 4. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Default Admin:** `admin@corp.local` / `Admin@123`

⚠️ **Change default admin password immediately after first login!**

## Port Configuration

| Service | Internal Port | Host Port | Purpose |
|---------|--------------|-----------|---------|
| Frontend | 80 | 3000 | Web UI (Nginx) |
| Backend | 3001 | 3001 | API Server |

## Volume Management

### Data Persistence
```yaml
volumes:
  backend-data:    # Database + Prisma files
  uploads-data:    # User-uploaded attachments
```

### Backup Strategy
```bash
# Backup volumes
docker run --rm -v supports_backend-data:/data -v $(pwd):/backup alpine tar czf /backup/backend-data-backup.tar.gz /data

# Restore volumes
docker run --rm -v supports_backend-data:/data -v $(pwd):/backup alpine tar xzf /backup/backend-data-backup.tar.gz
```

## Network Configuration

### Custom Domain Setup

1. Update `docker-compose.yml`:
```yaml
environment:
  - CORS_ORIGIN=https://support.yourdomain.com
```

2. Configure reverse proxy (Nginx/Traefik) for HTTPS:
```nginx
server {
    listen 443 ssl http2;
    server_name support.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Database Issues
If database initialization fails:
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d     # Recreate
```

### Frontend Not Loading
```bash
docker logs supports_frontend_1
# Check nginx logs for routing issues
```

### Backend API Errors
```bash
docker logs supports_backend_1
# Check for Prisma migration errors or port conflicts
```

### Check Service Health
```bash
# Frontend health
curl http://localhost:3000

# Backend health
curl http://localhost:3001/api/health
```

## Updating the Application

### Pull Latest Changes
```bash
docker-compose down
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

### In Portainer
1. Go to your stack
2. Click **Pull and redeploy**
3. Or use **Git Pull** if configured

## Security Checklist

Before production deployment:
- [ ] Change JWT_SECRET from default
- [ ] Change default admin password
- [ ] Configure CORS_ORIGIN to your domain
- [ ] Enable HTTPS via reverse proxy
- [ ] Set up regular backups
- [ ] Configure firewall rules
- [ ] Review SMTP settings

## Monitoring

### Check Container Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Resource Usage
```bash
docker stats
```

## Default Credentials

**⚠️ CHANGE THESE IMMEDIATELY AFTER FIRST LOGIN**

| User | Email | Password | Role |
|------|-------|----------|------|
| Admin | admin@corp.local | Admin@123 | Super Admin |
| Support | support@corp.local | Support@123 | IT Support |

## Support

For issues or questions:
1. Check `SECURITY_AUDIT.md` for security recommendations
2. Review `README.md` for feature documentation
3. Check Docker logs for errors

---
**Version:** 2.0.0  
**Last Updated:** 2026-01-13

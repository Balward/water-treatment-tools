# Water Treatment Tools - Docker Deployment Guide

This guide covers deploying the Water Treatment Tools application on Docker, specifically configured for Unraid servers with automatic updates from GitHub.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Nginx Proxy Manager (for reverse proxy)
- GitHub repository with the application code

### Deployment Options

#### Option 1: Docker Compose (Recommended for Unraid)

1. **Clone or download this repository to your Unraid server**
2. **Navigate to the project directory**
3. **Start the services:**

```bash
docker-compose up -d
```

The application will be available at `http://your-server-ip:6767`

#### Option 2: Direct Docker Run

```bash
# Build the image locally
docker build -t water-treatment-tools .

# Run the container
docker run -d \
  --name water-treatment-tools \
  --restart unless-stopped \
  -p 6767:80 \
  -v ./data:/usr/share/nginx/html/data:ro \
  water-treatment-tools
```

#### Option 3: Use Pre-built Image from GitHub Container Registry

```bash
# Pull and run the latest image
docker run -d \
  --name water-treatment-tools \
  --restart unless-stopped \
  -p 6767:80 \
  ghcr.io/your-username/water-treatment-tools:latest
```

## 🔄 Automatic Updates

### Method 1: Watchtower (Included in docker-compose.yml)

The docker-compose.yml includes Watchtower which automatically:
- Checks for new images every 5 minutes
- Pulls updated images when available
- Restarts containers with new images
- Cleans up old images

### Method 2: GitHub Actions + Webhook

1. **Set up a webhook endpoint on your Unraid server** (optional)
2. **Add webhook URL to GitHub secrets** as `DEPLOY_WEBHOOK_URL`
3. **Every push to main branch will trigger:**
   - Docker image build
   - Push to GitHub Container Registry
   - Webhook notification to your server

## 🌐 Nginx Proxy Manager Setup

### Add Proxy Host

1. **Domain Names:** `water-treatment.yourdomain.com`
2. **Scheme:** `http`
3. **Forward Hostname/IP:** Your Unraid server IP
4. **Forward Port:** `6767`
5. **Enable SSL:** Yes (with Let's Encrypt)

### Custom Nginx Configuration (if needed)

```nginx
location / {
    proxy_pass http://your-server-ip:6767;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Handle file uploads
    client_max_body_size 50M;
}
```

## 📁 Directory Structure

```
water-treatment-tools/
├── Dockerfile                 # Main Docker image definition
├── docker-compose.yml        # Docker Compose configuration
├── nginx.conf                # Nginx web server configuration
├── packages/
│   ├── dashboard/            # Main dashboard (landing page)
│   └── robojar-analyzer/     # RoboJar analysis tool
├── city-logos/               # Logo assets
├── data/                     # Data files
└── .github/workflows/        # GitHub Actions for CI/CD
```

## 🔧 Configuration

### Environment Variables

- `TZ`: Timezone (default: America/New_York)
- `WATCHTOWER_POLL_INTERVAL`: Update check interval in seconds (default: 300)

### Port Configuration

The application runs on port 80 inside the container and is mapped to port 6767 on the host. To change the external port, modify the docker-compose.yml:

```yaml
ports:
  - "YOUR_PORT:80"  # Change YOUR_PORT to desired port
```

### Volume Mounts

- `./data:/usr/share/nginx/html/data:ro` - Mount data directory (read-only)

## 🛠 Troubleshooting

### Container Won't Start

1. **Check logs:**
```bash
docker-compose logs water-treatment-tools
```

2. **Verify port availability:**
```bash
netstat -tulpn | grep 6767
```

3. **Check file permissions:**
```bash
ls -la packages/
```

### Can't Access Application

1. **Verify container is running:**
```bash
docker ps | grep water-treatment
```

2. **Test local access:**
```bash
curl http://localhost:6767
```

3. **Check nginx configuration:**
```bash
docker exec water-treatment-tools nginx -t
```

### Updates Not Working

1. **Check Watchtower logs:**
```bash
docker-compose logs watchtower
```

2. **Manually pull updates:**
```bash
docker-compose pull
docker-compose up -d
```

## 🔒 Security Considerations

- The nginx configuration includes basic security headers
- Data directory is mounted read-only
- No sensitive information should be stored in the repository
- Consider using secrets management for production deployments

## 📊 Monitoring

### Health Check

The container includes a health check endpoint:
```bash
curl http://your-server-ip:6767/health
```

### Container Status

```bash
# Check container health
docker inspect water-treatment-tools | grep Health -A 10

# View real-time logs
docker-compose logs -f water-treatment-tools
```

## 🚀 Advanced Configuration

### Custom Domain with SSL

1. Update docker-compose.yml labels with your domain
2. Configure your DNS to point to your server
3. Nginx Proxy Manager will handle SSL automatically

### Multiple Environments

Create separate compose files:
- `docker-compose.yml` - Production
- `docker-compose.dev.yml` - Development
- `docker-compose.local.yml` - Local testing

Run with: `docker-compose -f docker-compose.dev.yml up -d`

## 📋 Maintenance

### Regular Tasks

1. **Monitor disk usage** (Docker images can accumulate)
2. **Review logs** for any errors or security issues
3. **Backup data directory** if needed
4. **Update base images** periodically

### Commands

```bash
# View container stats
docker stats water-treatment-tools

# Clean up unused images
docker image prune -f

# Restart services
docker-compose restart

# Update and restart
docker-compose pull && docker-compose up -d
```
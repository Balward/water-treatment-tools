# Unraid Deployment with Claude AI Support

This guide shows how to deploy the water treatment tools with Claude AI functionality on Unraid without exposing your API key in the git repository.

## Overview

The Docker container now includes:
- **Static web files** served on port 6767 (nginx)
- **Claude proxy server** on port 6768 (Node.js)
- **Environment variable support** for secure API key handling

## Step 1: Prepare Your Local Environment

### 1.1 Create the .env file locally (DO NOT COMMIT THIS)

```bash
# In your project directory
cp .env.template .env
```

Edit the `.env` file:
```bash
CLAUDE_API_KEY=sk-ant-api03-YOUR-ACTUAL-API-KEY-HERE
```

### 1.2 Test locally first

```bash
# Build and test the container locally
docker-compose up --build

# Test both services:
# - Web interface: http://localhost:6767
# - API health check: http://localhost:6768/health
```

## Step 2: Commit and Push (Without API Key)

```bash
git add .
git commit -m "Add Claude AI proxy server with environment variable support"
git push origin main
```

**✅ Safe to commit:**
- `.env.template` (template with placeholder)
- Updated Dockerfile and docker-compose.yml
- Updated client-side code

**❌ Never commit:**
- `.env` file (contains your actual API key)
- Any file with your real API key

## Step 3: Unraid Container Setup

### 3.1 Create Docker Container in Unraid

1. **Go to Docker tab** in Unraid
2. **Add Container**
3. **Configure as follows:**

```yaml
Name: water-treatment-tools
Repository: your-registry/water-treatment-tools:latest
Network Type: Bridge

Port Mappings:
- Host Port: 6767 → Container Port: 80 (Web Interface)
- Host Port: 6768 → Container Port: 3001 (Claude API Proxy)

Environment Variables:
- CLAUDE_API_KEY = sk-ant-api03-YOUR-ACTUAL-API-KEY-HERE
- TZ = America/New_York
- NODE_ENV = production

Restart Policy: unless-stopped
```

### 3.2 Alternative: Use docker-compose in Unraid

1. **SSH into Unraid**
2. **Create project directory:**
   ```bash
   mkdir -p /mnt/user/appdata/water-treatment-tools
   cd /mnt/user/appdata/water-treatment-tools
   ```

3. **Clone repository:**
   ```bash
   git clone https://github.com/your-username/water-treatment-tools.git .
   ```

4. **Create .env file:**
   ```bash
   cp .env.template .env
   nano .env  # Add your API key
   ```

5. **Deploy:**
   ```bash
   docker-compose up -d --build
   ```

## Step 4: Verify Deployment

### 4.1 Check Services

```bash
# Check container is running
docker ps | grep water-treatment

# Check logs
docker logs water-treatment-tools

# Test web interface
curl http://YOUR-UNRAID-IP:6767

# Test Claude proxy
curl http://YOUR-UNRAID-IP:6768/health
```

### 4.2 Test Claude AI Feature

1. **Access web interface:** `http://YOUR-UNRAID-IP:6767`
2. **Go to Data Analyzer**
3. **Navigate to Optimization tab**
4. **Create a correlation scatter plot**
5. **Click "💡 Explain Correlation"**
6. **Should see AI-generated explanation**

## Step 5: Updates and Maintenance

### 5.1 Updating Code (Without API Key Changes)

```bash
# On your local machine
git pull origin main
git add .
git commit -m "Update features"
git push origin main

# On Unraid
cd /mnt/user/appdata/water-treatment-tools
git pull origin main
docker-compose up -d --build
```

### 5.2 Updating API Key

```bash
# On Unraid, edit the .env file
nano /mnt/user/appdata/water-treatment-tools/.env

# Restart container
docker-compose restart
```

## Troubleshooting

### Container Won't Start
- Check logs: `docker logs water-treatment-tools`
- Verify .env file exists and has correct API key
- Check port conflicts (6767, 6768)

### AI Explanations Not Working
- Verify Claude proxy is running: `http://YOUR-UNRAID-IP:6768/health`
- Check API key in container: `docker exec water-treatment-tools env | grep CLAUDE`
- Check browser console for errors
- Verify Anthropic account has credits

### Port Access Issues
- Ensure Unraid firewall allows ports 6767, 6768
- Check if ports are already in use by other containers
- Verify network configuration in docker-compose.yml

## Security Best Practices

1. **Never commit .env files**
2. **Use strong API keys** (rotate periodically)
3. **Limit container network access** if possible
4. **Monitor API usage** in Anthropic console
5. **Keep Unraid and Docker updated**

## Architecture Diagram

```
[Browser] → [Unraid:6767] → [nginx] → [Static Files]
                     ↓
[Browser] → [Unraid:6768] → [Node.js] → [Claude API]
```

Both services run in the same container, with nginx serving static files and Node.js handling AI API calls securely.
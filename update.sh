#!/bin/bash

# Water Treatment Tools - Update Script for Unraid
# This script pulls the latest changes and rebuilds the Docker containers

# Make this script executable
chmod +x "$0"

echo "🚀 Water Treatment Tools - Update Script"
echo "========================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml not found! Please run this script from the water-treatment-tools directory."
    echo "Expected location: /mnt/user/appdata/water-treatment-tools/"
    exit 1
fi

# Check if git repository exists
if [ ! -d ".git" ]; then
    print_error "Not a git repository! Please ensure you're in the correct directory."
    exit 1
fi

# Start update process
print_status "Starting update process..."
echo

# Step 1: Check current status
print_status "Checking current git status..."
git status --porcelain
if [ $? -ne 0 ]; then
    print_error "Failed to check git status"
    exit 1
fi

# Step 2: Stash any local changes
print_status "Stashing any local changes..."
git stash push -m "Auto-stash before update $(date)"
if [ $? -eq 0 ]; then
    print_success "Local changes stashed successfully"
else
    print_warning "No local changes to stash"
fi

# Step 3: Fetch and pull latest changes
print_status "Fetching latest changes from GitHub..."
git fetch origin
if [ $? -ne 0 ]; then
    print_error "Failed to fetch from remote repository"
    exit 1
fi

print_status "Pulling latest changes..."
PULL_OUTPUT=$(git pull origin main 2>&1)
PULL_EXIT_CODE=$?

if [ $PULL_EXIT_CODE -eq 0 ]; then
    if echo "$PULL_OUTPUT" | grep -q "Already up to date"; then
        print_success "Repository is already up to date"
        NEEDS_REBUILD=false
    else
        print_success "Successfully pulled latest changes"
        echo "$PULL_OUTPUT"
        NEEDS_REBUILD=true
    fi
else
    print_error "Failed to pull changes"
    echo "$PULL_OUTPUT"
    exit 1
fi

# Step 4: Stop current containers
print_status "Stopping current containers..."
docker-compose down
if [ $? -eq 0 ]; then
    print_success "Containers stopped successfully"
else
    print_warning "Some containers may not have been running"
fi

# Step 5: Rebuild and start containers
if [ "$NEEDS_REBUILD" = true ]; then
    print_status "Rebuilding and starting containers with latest changes..."
    docker-compose up -d --build
else
    print_status "Starting containers (no rebuild needed)..."
    docker-compose up -d
fi

if [ $? -eq 0 ]; then
    print_success "Containers started successfully"
else
    print_error "Failed to start containers"
    exit 1
fi

# Step 6: Wait a moment for containers to start
print_status "Waiting for containers to initialize..."
sleep 5

# Step 7: Check container status
print_status "Checking container status..."
docker-compose ps

# Step 8: Test application health
print_status "Testing application health..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:6767/ 2>/dev/null)
if [ "$HEALTH_CHECK" = "200" ]; then
    print_success "Application is healthy and responding"
else
    print_warning "Health check failed (HTTP $HEALTH_CHECK). Application may still be starting..."
fi

# Step 9: Clean up old Docker images
print_status "Cleaning up old Docker images..."
docker image prune -f > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_success "Old Docker images cleaned up"
else
    print_warning "Could not clean up old images"
fi

# Final status
echo
echo "========================================"
print_success "Update completed successfully!"
echo
echo "🌐 Application URLs:"
echo "   • Dashboard: http://$(hostname -I | awk '{print $1}'):6767/"
echo "   • RoboJar Analyzer: http://$(hostname -I | awk '{print $1}'):6767/apps/robojar-analyzer/"
echo "   • Dose Predictor: http://$(hostname -I | awk '{print $1}'):6767/apps/dose-predictor/"
echo "   • Data Analyzer: http://$(hostname -I | awk '{print $1}'):6767/apps/data-analyzer/"
echo "   • Data Parser: http://$(hostname -I | awk '{print $1}'):6767/apps/data-parser/"
echo "   • Video Tutorials: http://$(hostname -I | awk '{print $1}'):6767/apps/video-tutorials/"
echo
echo "📊 Container Status:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo
echo "🕐 Update completed at: $(date)"
echo "========================================"
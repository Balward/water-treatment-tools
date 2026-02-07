#!/bin/bash

# Water Treatment Tools - Update Script for Unraid
# Pulls latest changes, protects .env, and restarts the stack with concise status output

set -o pipefail

header()    { echo -e "\n==== $1 ===="; }
info()      { echo -e "[INFO]  $1"; }
ok()        { echo -e "[OK]    $1"; }
warn()      { echo -e "[WARN]  $1"; }
err()       { echo -e "[ERROR] $1"; }

COMPOSE_CMD=(docker-compose)
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
fi

NEEDS_REBUILD=false
STASHED=false
ENV_BACKUP=false

# Basic safety checks
if [ ! -f "docker-compose.yml" ]; then
    err "docker-compose.yml not found. Run from /mnt/user/appdata/water-treatment-tools."
    exit 1
fi

if [ ! -d ".git" ]; then
    err "Not a git repository."
    exit 1
fi

# Abort if merge/rebase is already in progress
if git diff --name-only --diff-filter=U | grep -q .; then
    err "Unmerged files detected. Resolve them before running the updater:"
    git diff --name-only --diff-filter=U
    exit 1
fi

if [ -d ".git/rebase-apply" ] || [ -d ".git/rebase-merge" ]; then
    err "A git rebase is in progress. Finish or abort it, then rerun this script."
    exit 1
fi

header "Water Treatment Tools - Update"
info "Using compose command: ${COMPOSE_CMD[*]}"

# Show concise repo status
header "Repo Status"
git status -sb

# Protect .env
if [ -f ".env" ]; then
    cp .env .env.backup
    ENV_BACKUP=true
    ok "Backed up .env -> .env.backup"
fi

# Ensure .env is ignored
if ! grep -q "^\\.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
    info "Added .env to .gitignore"
fi

# Stash tracked changes except .env
if git status --porcelain | grep -v '^??' | grep -vq '^.. \.env$'; then
    info "Stashing local changes (excluding .env)..."
    if git stash push -m "Auto-stash before update $(date)" -- ':!.env'; then
        STASHED=true
        ok "Local changes stashed"
    else
        warn "Could not stash changes (index may be dirty); continuing"
    fi
else
    info "No local changes to stash"
fi

# Fetch and pull
header "Pull Latest"
if git fetch --prune; then
    PULL_OUTPUT=$(git pull --rebase 2>&1)
    if echo "$PULL_OUTPUT" | grep -q "Already up to date"; then
        ok "Repository already up to date"
    else
        echo "$PULL_OUTPUT"
        ok "Repository updated"
        NEEDS_REBUILD=true
    fi
else
    err "Failed to fetch from remote"
    exit 1
fi

# Reapply stash if needed
if [ "$STASHED" = true ]; then
    info "Restoring stashed changes..."
    if git stash pop; then
        ok "Stash restored"
        NEEDS_REBUILD=true
    else
        err "Stash pop produced conflicts. Resolve manually and rerun."
        exit 1
    fi
fi

# Restore .env after git operations
if [ "$ENV_BACKUP" = true ] && [ -f ".env.backup" ]; then
    mv .env.backup .env
    ok ".env restored"
fi

# Stop containers
header "Containers"
info "Stopping running containers..."
if "${COMPOSE_CMD[@]}" down --remove-orphans >/dev/null; then
    ok "Containers stopped"
else
    warn "Some containers were not running"
fi

# Start containers
if [ "$NEEDS_REBUILD" = true ]; then
    info "Starting with rebuild..."
    START_OUTPUT=$("${COMPOSE_CMD[@]}" up -d --build 2>&1)
else
    info "Starting without rebuild..."
    START_OUTPUT=$("${COMPOSE_CMD[@]}" up -d 2>&1)
fi

if [ $? -eq 0 ]; then
    ok "Containers started"
else
    err "Failed to start containers"
    echo "$START_OUTPUT"
    exit 1
fi

# Quick health checks
header "Health Checks"
HOST_IP=$(hostname -I | awk '{print $1}')
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$HOST_IP:6767/" 2>/dev/null)
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$HOST_IP:6768/health" 2>/dev/null)

if [ "$WEB_STATUS" = "200" ]; then
    ok "Web UI responding (HTTP 200)"
else
    warn "Web UI not ready (HTTP $WEB_STATUS)"
fi

if [ "$API_STATUS" = "200" ]; then
    ok "Claude proxy healthy (HTTP 200)"
else
    warn "Claude proxy not ready (HTTP $API_STATUS)"
fi

header "Container Status"
"${COMPOSE_CMD[@]}" ps

# Summary
header "Summary"
echo "- Repo updated:        $( [ "$NEEDS_REBUILD" = true ] && echo yes || echo no changes )"
echo "- Stash reapplied:     $( [ "$STASHED" = true ] && echo yes || echo not needed )"
echo "- Web UI:              HTTP $WEB_STATUS"
echo "- Claude proxy:        HTTP $API_STATUS"
echo "- Access URLs:"
echo "    Dashboard:         http://$HOST_IP:6767/"
echo "    RoboJar Analyzer:  http://$HOST_IP:6767/apps/robojar-analyzer/"
echo "    Dose Predictor:    http://$HOST_IP:6767/apps/dose-predictor/"
echo "    Data Analyzer:     http://$HOST_IP:6767/apps/data-analyzer/"
echo "    Data Parser:       http://$HOST_IP:6767/apps/data-parser/"
echo "    Video Tutorials:   http://$HOST_IP:6767/apps/video-tutorials/"
echo "    Claude Health:     http://$HOST_IP:6768/health"
echo
ok "Update complete"

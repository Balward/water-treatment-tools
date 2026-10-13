#!/usr/bin/env bash
set -euo pipefail
source_dir=/mnt/user/appdata/operator-inventory-source
data_dir=/mnt/user/appdata/operator-inventory
archive=/mnt/user/appdata/operator-inventory.tar.gz
backup_dir=/mnt/user/appdata/operator-inventory-backups/$(date +%Y%m%d-%H%M%S)-$$
command -v docker >/dev/null
docker compose version >/dev/null
command -v curl >/dev/null
test -s "$archive"
# Protect backups because the mailbox configuration contains credentials.
umask 077
mkdir -p "$backup_dir" "$source_dir" "$data_dir"
if [ -f "$data_dir/inventories.json" ]; then
  cp "$data_dir/inventories.json" "$backup_dir/inventories.json"
fi
if [ -f "$source_dir/.env" ]; then
  cp "$source_dir/.env" "$backup_dir/.env"
fi
if [ -f "$source_dir/compose.yaml" ]; then
  tar --exclude='./node_modules' --exclude='./.env' -czf "$backup_dir/previous-source.tar.gz" -C "$source_dir" .
fi
# The archive has an explicit file list and excludes .env and inventory data.
tar -xzf "$archive" -C "$source_dir"
chown 1000:1000 "$data_dir"
# Source files must be readable by the container's non-root Node user.
find "$source_dir" -type d -exec chmod 755 {} +
find "$source_dir" -type f ! -name '.env' -exec chmod 644 {} +
if [ -f "$source_dir/.env" ]; then chmod 600 "$source_dir/.env"; fi
cd "$source_dir"
docker compose config --quiet
docker compose up -d --build
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3080/api/health >/dev/null; then
    printf 'App is healthy. Backup: %s\n' "$backup_dir"
    docker compose ps
    exit 0
  fi
  sleep 2
done
printf 'Health check failed. Backup: %s\n' "$backup_dir" >&2
docker compose logs --tail 50 operator-inventory
exit 1

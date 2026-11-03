#!/usr/bin/env bash
set -euo pipefail
umask 077
source_dir=/mnt/user/appdata/water-treatment-tools
archive=/mnt/user/appdata/water-treatment-tools.tar.gz
stamp=$(date +%Y%m%d-%H%M%S)-$$
backup_dir=/mnt/user/appdata/water-treatment-tools-backups/$stamp
for program in docker curl tar flock; do command -v "$program" >/dev/null; done
docker compose version >/dev/null
exec 9>/mnt/user/appdata/water-treatment-tools-deploy.lock
flock -n 9 || { echo 'A suite deployment is already running.' >&2; exit 1; }
mkdir -p "$source_dir" "$backup_dir"
if [ "${1:-}" != '--installed-source' ]; then test -s "$archive"; fi
if [ -f "$source_dir/data/live-ops-state.json" ]; then cp "$source_dir/data/live-ops-state.json" "$backup_dir/live-ops-state.json"; fi
if [ -d "$source_dir/data/plant-rounds" ]; then cp -a "$source_dir/data/plant-rounds" "$backup_dir/plant-rounds"; fi
if [ -d "$source_dir/data/application-review" ]; then cp -a "$source_dir/data/application-review" "$backup_dir/application-review"; fi
if [ -f "$source_dir/.env" ]; then cp "$source_dir/.env" "$backup_dir/.env"; fi
if [ -f "$source_dir/docker-compose.yml" ]; then
  cp "$source_dir/docker-compose.yml" "$backup_dir/docker-compose.yml"
  tar --exclude='./data' --exclude='./Videos' --exclude='./node_modules' --exclude='./.git' --exclude='./.env' --exclude='./.env.backup' -czf "$backup_dir/previous-source.tar.gz" -C "$source_dir" .
fi
previous_image=$(docker inspect water-treatment-tools --format '{{.Image}}' 2>/dev/null || true)
if [ -n "$previous_image" ]; then docker image tag "$previous_image" "water-treatment-tools:rollback-$stamp"; fi
if [ "${1:-}" != '--installed-source' ]; then tar -xzf "$archive" -C "$source_dir"; fi
# Packages overlay existing source. Retire the removed alternate landing app so
# it cannot be copied back into the next image from an older server checkout.
rm -f -- "$source_dir/apps/dashboard-new/index.html" "$source_dir/apps/dashboard-new/styles.css"
rmdir -- "$source_dir/apps/dashboard-new" 2>/dev/null || true
# Remove the retired experimental app from older overlaid source packages.
for retired_file in index.html styles.css script.js schedule-data.js check-browser.cjs import-workbook.ps1 README.md; do
  rm -f -- "$source_dir/apps/schedule-dashboard/$retired_file"
done
rmdir -- "$source_dir/apps/schedule-dashboard" 2>/dev/null || true
# Keep the host's ports, persistent volumes, networks, and environment settings.
if [ -f "$backup_dir/docker-compose.yml" ]; then cp "$backup_dir/docker-compose.yml" "$source_dir/docker-compose.yml"; fi
cd "$source_dir"
docker compose config --quiet
# Build first. A build failure leaves the healthy running container in place.
docker compose build water-treatment-tools
healthy() {
  for attempt in $(seq 1 30); do
    if [ "$(docker inspect water-treatment-tools --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' 2>/dev/null)" = healthy ] \
      && curl --fail --silent http://127.0.0.1:6767/api/live-ops/state >/dev/null; then
      if [ "${1:-release}" = basic ] || {
        curl --fail --silent http://127.0.0.1:6767/ | grep -q 'operations-home.css' \
          && curl --fail --silent http://127.0.0.1:6767/apps/dashboard/operations-home.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/apps/dashboard/dashboard.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/shared/operations/navigation.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-flow/ | grep -q 'operations.js' \
          && curl --fail --silent http://127.0.0.1:6767/plant-flow/operations.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-flow/operations.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/assets/qrcodes/equipment-status-edit.svg >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/video-tutorials/ | grep -q 'operations.js' \
          && curl --fail --silent http://127.0.0.1:6767/video-tutorials/operations.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/video-tutorials/operations.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/dose-predictor/ | grep -q 'operations-ui.js' \
          && curl --fail --silent http://127.0.0.1:6767/dose-predictor/operations.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/dose-predictor/operations.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/dose-predictor/operations-ui.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/sodium-hypochlorite-calculator/ | grep -q 'calculation.js' \
          && curl --fail --silent http://127.0.0.1:6767/sodium-hypochlorite-calculator/calculation.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/sodium-hypochlorite-calculator/operations.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/sodium-hypochlorite-calculator/operations.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/robojar-analyzer/ | grep -q 'operations-ui.js' \
          && curl --fail --silent http://127.0.0.1:6767/robojar-analyzer/operations.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/robojar-analyzer/operations-ui.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/robojar-analyzer/operations.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/water-data-explorer/ | grep -q 'operations-ui.js' \
          && curl --fail --silent http://127.0.0.1:6767/water-data-explorer/operations.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/water-data-explorer/operations-ui.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/water-data-explorer/operations.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/shared/operations/study.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/regulation-100-study/ | grep -q 'operations-ui.js' \
          && curl --fail --silent http://127.0.0.1:6767/regulation-100-study/lessons.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/regulation-100-study/operations.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/regulation-100-study/operations-ui.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/regulation-100-study/operations.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/water-treatment-flashcards/ | grep -q 'operations-ui.js' \
          && curl --fail --silent http://127.0.0.1:6767/water-treatment-flashcards/operations.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/water-treatment-flashcards/operations-ui.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/water-treatment-flashcards/operations.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/ | grep -q 'startForm' \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/rounds.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/rounds.css >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/report.html >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/report.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/history.html >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/history.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/manage.html >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/manage.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/users.html >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/users.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/user-select.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/plant-rounds/drawdown.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/api/plant-rounds/users >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/api/plant-rounds/template >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/api/plant-rounds/2000-01-01/report.pdf >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/application-review/ | grep -q 'hiring-review-list' \
          && curl --fail --silent http://127.0.0.1:6767/application-review/hiring-reviews.js >/dev/null \
          && curl --fail --silent http://127.0.0.1:6767/api/application-review/sets >/dev/null;
      }; then return 0; fi
    fi
    sleep 2
  done
  return 1
}
if docker compose up -d --no-build water-treatment-tools && healthy; then
  printf 'Suite healthy. Backup and rollback image: %s\n' "$backup_dir"
  printf '%s\n' "$stamp" > "$source_dir/.last-deployment"
  docker compose ps water-treatment-tools
  exit 0
fi
printf 'Deployment failed; restoring previous image. Backup: %s\n' "$backup_dir" >&2
if [ -n "$previous_image" ]; then
  docker image tag "$previous_image" water-treatment-tools:latest
  docker compose up -d --no-build --force-recreate water-treatment-tools
  healthy basic || echo 'Rollback did not become healthy; inspect the container.' >&2
fi
exit 1

#!/usr/bin/env bash
set -euo pipefail
cd /mnt/user/appdata/operator-inventory-source
docker compose stop operator-inventory
# Restart even if the reset refuses an invalid data file.
trap 'docker compose up -d operator-inventory >/dev/null' EXIT
docker compose run --rm --no-deps operator-inventory node reset-history.js --data-dir /data --confirm-reset
docker compose up -d operator-inventory
trap - EXIT
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:3080/api/health >/dev/null; then
    docker compose exec -T operator-inventory node -e 'const fs=require("fs");const s=JSON.parse(fs.readFileSync("/data/inventories.json","utf8"));console.log(JSON.stringify({inventories:s.inventories.length,pendingItems:s.orderList.length,orders:s.orderHistory.length,catalogItems:s.catalogItems?.length??"seed catalog"}));if(s.inventories.length||s.orderList.length||s.orderHistory.length)process.exit(1);'
    exit 0
  fi
  sleep 2
done
docker compose logs --tail 50 operator-inventory
exit 1

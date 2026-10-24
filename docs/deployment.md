# Updating the suite and inventory

Keep the two containers separate. They share a deployment entry point, while retaining their existing ports, reverse-proxy destinations, and persistent data directories.

From the repository root on Windows:

```powershell
# Update both applications
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1

# Update both over Tailscale when away from home
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Target All -Server gibbhub

# Update just the suite (including Equipment Status Board)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Target Suite

# Update just inventory
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Target Inventory

# Validate and package without contacting Unraid
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Target Suite -PackageOnly
```

The default destination is `root@192.168.0.88`; `-Server` and `-User` override it. SSH access and local Node.js, PowerShell, tar, ssh, and scp are required. Inventory also uses npm and runs its existing test suite. Suite deployment checks JavaScript syntax; run `node scripts/check-live-ops.cjs` for the production browser/API regression check before dashboard changes. That check uses Chrome, temporary data, and local ports 3191/8781; it never writes the real dashboard data.

The suite package excludes the inventory source, mockups, `.env`, runtime data, and node_modules. It contains the current working tree, so a Git push is not needed for this deployment method. The server backs up the existing source, environment configuration, Compose file, and equipment state before rebuilding. It builds while the old container remains available, replaces only the suite container, and checks Docker health plus the equipment API. A failed replacement attempts to restore the previous image. A build failure leaves the existing container running. Production data is never replaced by sample data or restored automatically from a backup.

The existing inventory deployer remains supported; the root command calls it for inventory. It backs up inventory data and environment settings before rebuilding. The two deployments run sequentially, and failure stops the command; this is not a transaction across both apps.

| Application | Source on Unraid | Persistent data | Host ports |
| --- | --- | --- | --- |
| Suite | `/mnt/user/appdata/water-treatment-tools` | `water-treatment-tools/data` | 6767 web, 6768 API |
| Inventory | `/mnt/user/appdata/operator-inventory-source` | `/mnt/user/appdata/operator-inventory` | 3080 |

The suite preserves the server's Compose file so host-specific volumes, ports, and networks are retained. An intentional Compose configuration change requires updating that host file separately. Secrets remain in the existing server `.env` files. No Docker volume or proxy migration is required.

Suite backups are under `/mnt/user/appdata/water-treatment-tools-backups/<timestamp-pid>`; inventory backups remain under `/mnt/user/appdata/operator-inventory-backups/`. Each suite deployment also saves the previous image as `water-treatment-tools:rollback-<timestamp-pid>`. To manually return to that image:

```sh
cd /mnt/user/appdata/water-treatment-tools
docker image tag water-treatment-tools:rollback-TIMESTAMP-PID water-treatment-tools:latest
docker compose up -d --no-build --force-recreate water-treatment-tools
```

Use the timestamp printed during deployment. This keeps the current data. To restore previous source files as well, use that backup's `previous-source.tar.gz` after reviewing the intended files; do not overwrite current data with an old snapshot unintentionally.

`bash update.sh` on Unraid now rebuilds the source already installed there, using the same backup and health-check process. It no longer stashes/rebases a checkout or stops the entire stack. To send new local changes, use `deploy.ps1` from Windows. The existing GitHub workflow still builds/publishes the suite image; it is a separate optional registry/webhook path, not a prerequisite for this command.

The wall URL is `/live-operations-dashboard/?mode=tv`; it starts in read-only viewing mode with a compact header, larger text, and a compact comments strip and a persistent Hide Header option. The regular URL retains equipment and comment editing, including persisted Pin On Wall Display choices. The edit QR opens the regular editor. Theme preferences are retained per browser. Connection checks use actual API/SSE activity and watchdog recovery; equipment update times describe operator edits. See [wall display behavior and validation](equipment-wall-display.md).

# Chemical Ledger shared storage

Open `https://water.gibbhub.io/chemical-ledger/` on every computer. Deliveries, usage, pricing, and planning settings are stored on gibbhub. The status bar confirms a successful save. Other open browsers refresh from the server every 15 seconds when no form is being edited; **Refresh Shared Ledger** loads changes immediately.

## Bring in existing work records

1. Open the updated ledger in the same browser and profile used to enter the original deliveries at work.
2. The **Bring Your Browser Records To Gibbhub** banner shows the local record counts. Select **Download Browser Backup** to keep a separate copy, then **Import This Browser**.
3. Confirm the import. The original browser copy is kept. Open or refresh the ledger at home to see the imported records.

A JSON file from the original app can also be added through **Import Backup**. Imports keep existing shared entries, skip identical record IDs, and stop if an ID refers to a different record. They preserve shared prices and existing planning settings once the shared ledger has been used. The first import into an unused ledger brings its settings as well. Two real deliveries with different IDs remain separate even if their quantities and dates match.

Old alum labels are corrected to dry US tons without changing numeric quantities or prices; review records entered as pounds. Polymer becomes Catfloc 8103+ Polymer while retaining its ID, records, and price.

## Save failures and simultaneous edits

Each save includes a server revision. A stale browser cannot overwrite another computer's changes. A conflict or failed connection displays an unsaved warning and retains a recovery copy on that browser when storage is available. **Download Backup** exports the displayed unsaved data. **Retry Saving** retries the same save once connectivity returns; a revision conflict requires downloading a backup, refreshing shared records, and reapplying the edit.

The app never switches to silently saving only on the PC. An unavailable or corrupt server file does not become an empty ledger. Keep the recovery browser data until the save succeeds or you have downloaded a backup.

## Server files and deployment

`chemical-ledger-api.js` writes `/app/data/chemical-ledger/ledger.json`, backed by the suite's existing `./data:/app/data` volume. On gibbhub that is `/mnt/user/appdata/water-treatment-tools/data/chemical-ledger/ledger.json`. Records survive container replacement. Previous saved revisions are retained in the adjacent `backups/` directory, and the suite deployer copies the entire chemical-ledger data directory into its timestamped backup before updating source.

Writes are serialized in the suite's single Node process and replace the data file atomically. Source archives exclude runtime data. No new Docker volume or reverse-proxy destination is needed.

Validation: `node scripts/check-operations.cjs chemical-ledger-api chemical-ledger-math chemical-ledger headers`. API checks cover independent clients, restart persistence, stale writes, import conflicts, duplicate imports, recovery snapshots, and corrupt-file protection. Browser checks use two isolated profiles and temporary server data, including failed saves and reload recovery. They never write test deliveries to production.

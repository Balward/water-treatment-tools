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

## Wednesday inventory usage

**Inventory Review** reads completed records from the chemical inventory app. The suite synchronizes saved readings every minute and keeps a server-side snapshot cache. **Refresh Inventory** requests the latest records immediately. Drafts are excluded; missing readings remain missing and genuine zero readings remain zero. The first completed record establishes an opening balance. Historical saved gallon totals are used as recorded, including their original inventory settings; this integration does not rewrite inventory records.

For each consecutive pair of completed inventories:

`purchased-stock withdrawal (gal) = opening stock + physical receipts − closing stock`

Permanganate uses purchased 20% stock only. The East 10% batch is excluded. Withdrawal measures movement out of purchased stock, not treatment feed; spills, transfers, and corrections can affect this balance and require operator review.

Enter **Physical Receipt** details on each ledger delivery: received gallons or pounds of product/solution, actual receiving date, and before/after-count timing for a delivery on an inventory date. These fields are separate from the invoice quantity and price. An invoice dated after delivery must use the actual receipt date for reconciliation. A delivery after the opening count or before the closing count belongs to that interval; unknown boundary timing blocks approval. Corrected invoices must update the existing delivery rather than create another physical receipt.

Current conversion profiles (versioned and retained with approved usage):

| Chemical | Inventory gallons to ledger billing quantity |
| --- | --- |
| Sodium hypochlorite | 1 gal per gal |
| Catfloc 8103+ Polymer | 2,295 lb / 265 filled gal = 8.66037736 lb/gal |
| Sodium permanganate | 2,550 lb / 265 filled gal = 9.62264151 product lb/gal |
| Aluminum sulfate | Approximate SG 1.327 × 8.34 lb/gal × 0.482 / 2,000 = 0.00266719038 dry US ton/gal |
| Sodium hydroxide | Pending confirmation of active lb/gal; approval is blocked |

Alum conversion is explicitly estimated. It does not replace actual dry tons billed by the supplier. For weight-based receipts, the same product densities convert physical pounds to gallons; hypo uses the example invoice SG 1.18 × 8.34 lb/gal. Use measured received gallons when available. The caustic example's active-pound billing and printed assay need clarification before automatic conversion.

Review each interval, confirm all receipts (including deliveries awaiting invoices), then select **Approve Usage**. Approval saves one usage entry with opening/closing snapshots, receipts, conversion version, review time, and fingerprint. Repeated approval cannot duplicate it. Unreviewed intervals do not contribute to totals or PO planning. Missing receipt details, missing stock readings, negative balances, and overlapping manual usage block approval. Dates other than Wednesday and intervals other than seven days are highlighted and retain their actual elapsed days.

Source corrections, deleted/backfilled inventories, or changed physical receipts mark affected approved usage as needing review and exclude it from totals. Earlier records and their provenance remain available. Review and approve the replacement interval(s). Connection failures retain the last saved snapshots and prevent new approvals until a fresh sync succeeds.

Manual historical usage remains supported. Add coverage start/end dates (with the entry date equal to coverage end) before combining manual totals and inventory intervals for a chemical/year. Adjacent periods may meet at a count date; overlapping periods cannot be approved. Cross-year dated quantities are allocated in proportion to elapsed days, an estimate rather than a measured daily distribution. Years with dated coverage annualize from the union of actual covered days; manual-only undated history keeps the existing months-covered setting. Relative historical weights still favor recent years. Short periods may be seasonal and should be reviewed before issuing POs.

`inventory-source.json` lives beside `ledger.json` in the persistent data directory and is included in deployment backups. The default source is `https://inventory.gibbhub.io/api/chemicals`; `CHEMICAL_INVENTORY_URL` can override it in the suite's server environment. The connection is read-only. No inventory-app deployment is required.

Integration validation: `node scripts/check-operations.cjs chemical-ledger-inventory chemical-ledger-api chemical-ledger-math chemical-ledger headers`. Tests use injected inventory records and temporary files, covering conversion units, receipts and count timing, zero/missing readings, overlapping history, year allocation, actual-day forecasting, approval idempotency, corrected/backfilled data, connection failure, restart persistence, and browser review at desktop/mobile sizes.

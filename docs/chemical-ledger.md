# Chemical Ledger: invoices and deliveries

Open `https://water.gibbhub.io/chemical-ledger/` on every computer. The app focuses on chemical invoices, billed quantities, supplier prices, taxes, and delivery spending. Its three pages are **Annual Overview**, **Deliveries & Invoices**, and **Chemical Pricing**.

## Record an invoice

Select **Record delivery**. Enter the invoice date, chemical, billed quantity, price per billing unit, supplier, invoice reference, and optional notes. Available suppliers include PVS DX, INC; Harcros; Nalco; and Chemtrade. Previously saved supplier names remain available.

Billing units remain chemical-specific: sodium hypochlorite in gallons; sodium hydroxide in active pounds; Catfloc 8103+ Polymer and sodium permanganate in product pounds; aluminum sulfate in dry US tons (2,000 dry pounds). Default pricing is $2.56/gal, $0.36/active lb, $2.34/lb, $1.64/lb, and $661/dry US ton, respectively. Chemical Pricing changes defaults for new invoices; existing invoices retain their recorded prices.

Enter **Superfund Excise Tax** and **Energy Surcharge** as dollar amounts for the delivery. The bold **Delivery Total** equals chemical subtotal plus both charges. Allocate invoice-wide charges once when recording multiple chemicals from one invoice. Historical records without these charges default to zero.

Annual Overview shows invoice spending, delivery counts, chemical subtotal, taxes/surcharges, billed quantities by chemical, and supplier totals. Average invoice unit price equals chemical subtotal divided by invoiced quantity, excluding taxes and surcharges. Quantities are never combined across chemicals with different billing units. Current-year overview totals exclude future-dated invoices; the invoice register still lists all saved invoices for the selected year. Choose an earlier reporting year to view or enter historical invoices.

## Shared records and browser migration

Invoices and pricing are saved centrally on gibbhub. The status bar confirms a successful save. Other open browsers refresh every 15 seconds when no form is being edited; **Refresh Shared Ledger** loads changes immediately.

To recover deliveries entered in the original browser-only app, open the updated ledger in that same browser/profile at work. In **Bring Your Browser Records To Gibbhub**, first select **Download Browser Backup**, then **Import This Browser**. The original browser copy is retained. A saved JSON file can also be added with **Import Backup**.

Imports preserve existing shared invoices, skip identical IDs, and stop if an ID refers to a different record. Once the shared ledger is in use, shared prices remain unchanged by imports. Older alum labels migrate to dry US tons without changing quantities or prices; review records entered as pounds. The older Polymer name migrates to Catfloc 8103+ Polymer.

Use **Export CSV** on Deliveries & Invoices for the selected year and chemical filter. CSV includes billed quantity, unit price, chemical subtotal, taxes, surcharge, bold-on-screen delivery total, invoice reference, supplier, and notes. **Download Backup** exports the complete JSON state.

## Save failures and preservation

Each save includes a server revision. A stale browser cannot overwrite another computer's changes. Conflicts or failed saves retain a recovery copy in that browser. Download Backup protects unsaved entries; Retry Saving retries the same save after reconnecting. For a revision conflict, download a backup, refresh shared records, and reapply the invoice edit. An unavailable or corrupt server file never becomes an empty ledger.

Inventory integration, usage entry/review, physical-receipt conversion forms, and usage-based PO forecasting have been removed. The suite makes no inventory requests or scheduled synchronizations. Retired inventory API routes return HTTP 410 so older pages cannot approve usage. Earlier saved usage, planning settings, receipt metadata, and inventory snapshots are retained for recovery and old-backup compatibility; they do not affect invoice reports. Invoice edits preserve earlier receipt metadata. Old clients attempting to change usage or planning settings are rejected until reloaded.

## Server files and verification

`chemical-ledger-api.js` writes `/app/data/chemical-ledger/ledger.json`, backed by the suite's existing data volume at `/mnt/user/appdata/water-treatment-tools/data/chemical-ledger/`. Previous revisions remain in `backups/`. Deployments back up the entire directory, exclude runtime data from source archives, and preserve the volume during container replacement. Writes are serialized and use an atomic file replacement.

Run `node scripts/check-operations.cjs chemical-ledger-api chemical-ledger-math chemical-ledger headers home`. Tests use temporary server data and isolated browser profiles. They cover invoice totals, unit prices, charges, year filtering, old-backup compatibility, archived-data preservation, retired integration routes, no inventory requests, cross-computer reads, imports, concurrent edits, offline recovery, and desktop/mobile layouts. Production verification does not create test invoices.

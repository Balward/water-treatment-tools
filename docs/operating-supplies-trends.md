# Operating Supplies Trends And PAR Review

Open **Operating Supplies Trends & PAR Review** from Recent Inventories, Inventory History, or Management > Supply Items.

The page shows each current Operating Supplies item's completed counts, its current PAR line, exact historical counts and PARs, and a review table across all items. Planning controls set the history window, delivery lead time, review interval, safety buffer, and rounding increment. Defaults (180 days, 7-day lead time, 7-day review, 50% buffer, whole units) are explicit planning assumptions, not supplier facts. They are not persisted or applied to other users.

The estimate uses net stock decline per eligible day multiplied by lead time plus review interval, then the buffer factor, rounded up. It requires three eligible intervals, at least 21 eligible days, at least 28 calendar days of compatible observations, and a positive decline. Flat and declining intervals up to 45 days are eligible; increasing intervals and longer gaps are excluded. It does not estimate true usage or predict receipts. Hidden restocking, count corrections, stockouts, and unobserved demand can distort results. Critical spares require operator judgment even when counts stay flat.

Only completed Operating Supplies records dated through today (America/Denver) are included. Product ID, normalized product name/number, count unit, and pack size must match the current catalog. Incompatible readings are flagged and excluded. Zero is preserved, missing counts are excluded, and the latest updated compatible completed inventory wins on duplicate dates. Charts are accompanied by an accessible table of exact values.

**Save PAR Of … For Future Inventories** is an explicit action using the existing revision-protected catalog API, with the full current item metadata preserved. Concurrent catalog changes reject the save. No automatic PAR changes, historical count updates, or inventory recalculations occur. Reload after a failed request to verify persisted state, especially after network errors.

Read-only endpoint: `GET /api/supply-trends`. It returns completed Operating Supplies snapshots for client-side review. No separate database or dependency is needed.

Validation: `npm test` within `apps/operator-inventory`; `node apps/operator-inventory/test/supply-trends-browser.js` from the repository root. Browser checks use temporary storage and verify chart rendering, explicit PAR save, preserved historical PARs, and desktop/mobile widths.

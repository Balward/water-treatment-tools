# Chemical Settings And Management

Inventory Management has three task sections: Supply Items, Bin Cards and Chemical Settings. Supply Items supports item/supplier/product-number search and location filtering; the existing item editor and bin-card workflow remain available.

Chemical Settings edits each existing chemical's default supplier, reorder level, standard bulk load or tote size, delivery lead time, stored tote count, usable tank capacities, gallons-per-inch factors and combined fixed-volume offset. Calibration factors and delivery capacity are independent. The East 10% permanganate tank remains monitored only; it cannot be included in full-strength stock through the editor. Tank identities, reading units and chemical types remain fixed in this version.

Preview Changes validates structured numeric inputs and shows an example gallon total, formula and usable planning capacity. Save New Version requires an operator chosen from the shared directory, a change summary and an effective date of today or later. Settings History retains immutable versions. Concurrent edits are rejected with the local entries preserved for reference; reload retrieves the latest version.

The revision-protected GET/POST /api/chemical-settings API stores versions in chemicalSettings in inventories.json. Versions change one chemical at a time. Applying a scheduled change to one chemical does not undo newer changes to another. There is no executable formula text or arbitrary code entered by operators.

New inventories capture a settings version and a full settingsSnapshot at creation based on the inventory date. Drafts keep their starting version. Completed inventories keep their snapshot when corrected. Legacy inventories without a snapshot retain the original workbook calculations; when an existing legacy draft or record is next saved it is bound to that original baseline, rather than newer settings. Imported workbook gallon snapshots are never recalculated.

Reports and trend planning use the saved inventory settings. The live To Order List uses current ordering settings with gallons calculated using each inventory's own snapshot. It preserves purchasing edits and recorded orders. Settings defaults do not overwrite an explicitly entered supplier on a pending order.

Settings are included in the normal inventory data backup. Deploy the standalone inventory package for this feature. The original design reference remains in apps/operator-inventory/design/chemical-settings.html; the operational editor is under Management > Chemical Settings.

Verification: npm test in apps/operator-inventory; node apps/operator-inventory/test/chemical-settings-browser.js from the repository root. Tests cover default and changed calculations, capacity independence, batch exclusion, versions, scheduling, draft/history preservation, persistence, conflicts and responsive Management workflows.

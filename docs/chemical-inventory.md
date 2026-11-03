# Chemical Inventory

Open **Chemical Inventory** from the inventory app's home worksheet cards. This is part of the standalone inventory deployment, not the general app-suite container. It uses the inventory theme and shared Applications header.

The home worksheet card resumes an unfinished draft when one exists; otherwise it opens the same New Inventory popup used for Operating Supplies. Choose a date (today by default) and operator, then Start Counting saves an empty draft and opens the chemical worksheet with those details. A date already recorded is rejected in the popup without overwriting the existing inventory or clearing the entered operator. New inventories can only be started through this home popup. Existing worksheets and reports have no New Inventory action; the Inventory tab returns to the selected saved inventory. Explicit report links still open their selected report. Opening the chemical worksheet directly without a saved date resumes an unfinished draft or shows History when none exists, including old links with view=new.

## Entry And History

Select a date (today by default), enter an operator name, and record tank levels in **inches**. Entry uses supply-style label/quantity rows with large numeric inputs; live totals and calculation explanations are omitted. Stored polymer and 20% permanganate inventory is entered in **gallons**. Salt is entered in fractional **pallets**. The saved report includes expandable readings and calculation details, including **265-gallon IBC totes** and **49 × 50-pound bags per pallet**. Half a pallet is approximately 25 bags; the underlying weight calculation uses exactly 49 bags per pallet.

Readings automatically save as a **draft** after entering a date and operator name. Save Draft also saves explicitly. Drafts appear alongside supply inventories on the main page with a **Resume** link and progress count; opening the Chemical Inventory card also resumes unfinished work. Returning through the home link or shared Apps menu waits for unsaved changes to save. Failed saves keep the current entries visible and require reloading to resolve revision conflicts.

**View Report** saves and opens a reviewable draft report, including partial totals. **Complete Inventory** becomes available once all 16 readings are entered, including salt, NWOS, and the monitored East batch tank. View opens a report; Edit allows corrections to completed inventories without reopening them as drafts or changing their original completion date. Main history and recent cards share View, Edit, and a confirmed Delete button for both supply and chemical records. Completed corrections require an explicit edit request and retain stale-revision protection. Missing inputs remain blank rather than becoming zero; enter 0 explicitly for an empty tank or no stored inventory. There remains one chemical inventory per date. Drafts lock the date after their first save.

Only one unfinished chemical inventory can be started at a time. Complete or explicitly delete it before starting a different date. Supply types independently enforce the same rule: attempts to start again resume their existing draft and preserve the original operator, date, and counts, including simultaneous starts from two devices. Pre-existing duplicate supply drafts are preserved and can be resumed, completed, or explicitly deleted; no records are automatically discarded.

On upgrade, the latest app-entered legacy chemical snapshot is reopened as a draft if it is partial and no chemical draft already exists. A backup is made before this one-time conversion. Older snapshots and imported workbook inventories remain history with their recorded values unchanged. Chemical history uses the same Draft/Completed distinction as the main page. NWOS use for completed readings is based on the previous completed reading, so an unfinished backdated counter reading does not change completed water-use history.

The History tab lists saved dates and gallons, with View Inventory, Edit Readings (for app-created records), and confirmed Delete controls. Unsaved entries prompt before leaving. Revision checks reject stale writes when another browser has changed the inventory. Reload Saved Readings retrieves the current records after confirmation if there are unsaved changes. The supplied workbook's 41 recorded 2026 inventories are imported on first startup after this update, as described below.

Chemical usage and a received-delivery ledger are not tracked. Chemicals have no photos. The supplied ordering document is not used.

## To Order List Integration

The existing To Order List now combines supply purchases and chemical recommendations with All / Chemicals / Supplies filters. Supply photos and product links remain intact. The latest completed app-entered chemical inventory supplies the on-hand values; earlier completed readings, including workbook snapshots, inform recent usage. Imported workbook history alone does not create purchases. Draft readings do not affect recommendations.

A chemical appears when it reaches the reorder level, or its forecast order date is due. Forecast dates account for seven-day lead time and capacity for a standard delivery. Recommendations show the reading date, on-hand gallons, reorder level, recent usage, suggested quantity, expected delivery and capacity/stale-reading cautions. Polymer and permanganate default to one 265-gallon tote; bulk deliveries use the facility's configured standard load.

There is one pending entry per chemical. New completed readings update its planning information while preserving operator-entered quantity, notes, supplier and delivery-date overrides. Replenished inventory removes recommendations that are no longer due. Supply entries are not changed by this reconciliation.

Edit Order Details allows a chemical supplier and expected delivery date to be entered. Both are required before a chemical can be recorded as placed; delivery cannot precede the recorded order date. Review and printed purchase checklists include chemical delivery dates and retain supply photos. Placed Orders saves the chemical details alongside supply entries.

Removing a recommendation or recording it as placed suppresses recreation from the same completed reading, including across restarts. A scheduled chemical delivery also covers later readings taken on or before that delivery date. A new reading after the scheduled date can recommend another order; recording a placed order does not add gallons or prove receipt. Verify the delivery has actually arrived when taking the next inventory. This version has no separate Received status or automatic supplier submission.

The server uses `chemical-orders.js` to reconcile recommendations and persists its resolution markers with inventory data. Normal order-list revision checks apply to chemical orders too. Browser checks: `node apps/operator-inventory/test/chemical-orders-browser.js`.

## Inventory Reports

Recent Inventories and Inventory History use the same card structure for chemical and supply inventories: title/status, date/operator, ordering summary, count progress, View/Edit/Delete actions and a full-width report button. Chemical ordering counts are assessed as of each inventory date using its saved settings and earlier completed readings; later inventories do not change a historical card's decision. These are inventory report results, not counts of unplaced purchases in today's To Order List. No Order Needed appears only when the assessment is complete; sparse/missing chemical readings show Review Order Status, and draft reports remain provisional. The report bar opens that card's dated inventory report, including when no order is needed.

View Report shows recorded tank levels in inches and stored inventory in gallons directly below the gallons-on-hand summary. These readings do not require expanding Calculation Details. Imported workbook snapshots still display their recorded gallons; old inch readings were not imported and are not reconstructed.

Order Guidance assesses each chemical using the report's own date and saved gallons, up to four comparable recent drawdown intervals, the configured reorder level, seven-day lead time, usable capacity, and standard delivery size. Later readings are excluded from historical reports. Other unfinished drafts do not supply historical trend inputs. Missing current gallons produce Reading Missing rather than borrowing a previous value. Draft reports mark the guidance provisional.

Order Now appears when the reorder level has been reached or the calculated order date is due as of the report date. Plan Order includes estimated order-by and target-delivery dates. Sparse or flat histories are explicitly identified instead of inventing a usage rate or order date. Reports show recent gallons/day when available, flag less than seven days of estimated supply, and retain tank/tote capacity constraints. Historical reports identify their as-of date and flag readings older than 14 days. They do not create or send purchase orders.

## Imported 2026 History

`chemical-history-2026.json` contains 41 inventories from January 8 through October 21, 2026, extracted directly from the supplied workbook's 2026 sheet. It contains cached numeric gallons from columns E, I, O, S, and X, plus the NWOS meter and cached water-used values from Z and AA. It contains no historical formulas, tank readings, or inferred salt counts. Historical operator names were not supplied and are shown as Not recorded in workbook.

Imported chemical totals are snapshots that are never recalculated using the October tank formulas. Edit corrects their recorded gallons directly, along with operator and notes, while preserving their workbook source, historical readings and recorded water usage. Historical NWOS usage is likewise preserved as recorded. New app readings continue to use the current formulas.

The startup import backs up an existing data file before changing it, skips dates already entered in the app, and records a migration marker. It does not run again after subsequent restarts or deployments, including if an imported entry is intentionally deleted. The normal Docker and deployment packages include the import bundle. No production server has been changed until the update is deployed and started.

## Verified Formulas

Source: **Weekly Chemical Inventory.xlsx**, sheet **2026**, dated **October 21, 2026**, row **45**. Excel shared formulas were resolved from their definition cells. The separate **Weekly Chemical Inventory Printout.xlsx** provides the entry layout, including salt and the East permanganate batch tank.

| Chemical | Formula For Gallons On Hand | Workbook Cells | October 21 Result |
|---|---|---|---|
| Sodium Hydroxide | `(East + Central + West) × 13.66 + 450` | B:D → E | 1,693.06 gal |
| Sodium Hypochlorite | `(East + West) × 27.5325 + 650` | G:H → I | 6,266.63 gal |
| Aluminum Sulfate | `East ÷ 12 × 805.40032 + (North + South + West) × 13.66` | K:N → O | 2,875.16016 gal |
| Polymer (8103+) | `Tank × 5.61 + Stored Inventory` | Q:R → S | 614.15 gal |
| Sodium Permanganate (20%) | `West × 7.143 + Stored Inventory` | V:W → X | 617.8589 gal |

The newer NaOH calculation uses inches despite the workbook's older feet heading. Preserve the +450 and +650 fixed-volume offsets. Aluminum sulfate's East tank has a different conversion from the other tanks. The East permanganate tank contains a diluted **10% batch**, is retained for level monitoring, and is deliberately excluded from **20% inventory**. The East reading is not required to calculate 20% gallons.

The browser and server share `public/chemical-math.js`. Calculations retain precision; displayed numbers are rounded to two decimal places. Values are not summed across different chemicals.

## Northwest Open Space Water

The meter is a separate water totalizer. Match the workbook's calculation: **(current meter − previous dated meter) × 1,000 gallons**. The app finds the previous recorded meter reading in date order, including when readings are entered out of order. Missing readings are skipped. A lower reading is flagged for a possible reset or correction instead of being reported as negative water usage. No rollover size is assumed. Editing or deleting app-entered readings recalculates subsequent app-entered water figures. Imported workbook water-use figures remain the recorded snapshots.

## Trends

The **Trends** tab provides an individual view for each of the five chemicals, salt, and Northwest Open Space water. Chemical series use saved gallons on hand, including preserved workbook snapshots; salt uses pallets. Salt has no imported historical counts, so it remains empty until actual counts are saved.

NWOS has separate measurements for **Water Used Between Readings** (gallons) and **Cumulative Meter Reading** (the original counter, multiplied by 1,000 gallons). Usage points represent their original reading intervals, which can differ in length. Meter resets are excluded from water-use charts and shown as review items in the values table. Cumulative-meter charts use a zoomed vertical axis, explicitly described above the chart.

Choose All History, Last 30/90/365 Days, or custom inclusive From/Through dates. Charts show latest, low, high, and net change for inventory/counter values. The water-use view instead shows a total for the displayed intervals. Dates use actual elapsed time on the horizontal axis. Missing values remain gaps, and recorded zero readings remain valid points. One reading produces a single-point chart; no readings produces an explanatory empty state.

Hover, tap, or keyboard-select a point for its exact value, date, and source. Left/Right and Home/End navigate chart readings; Enter or View This Inventory opens that saved inventory. A recorded-values table provides an alternate way to inspect dates, including missing values. Imported points are hollow and app-entered points are filled. Charts resize for phones without external libraries or network requests and refresh after saves/deletions.

### Recent-Usage Forecast

Show Forecast adds a separate dashed purple projection for 14, 30, or 60 days after the latest selected reading. Recorded values remain unchanged. Forecasts are computed locally from the selected date range, using at most four usable intervals within 42 days of that last reading, with a minimum of two usable intervals. The daily rate is total observed change divided by total elapsed days, so irregular reading intervals are weighted correctly.

For chemicals and salt, this is a **net drawdown estimate**, not measured consumption. Stock increases are excluded, missing values are not bridged, and the projection assumes no future replenishment. It stops at zero rather than going negative. A projected zero-inventory date is shown for positive-rate estimates within one year of the last reading. Flat histories produce a flat forecast; sparse histories show an explanation instead of a line. The basis, daily rate, and as-of date are displayed beside the chart.

NWOS cumulative-meter forecasts add recent positive meter change per day, excluding counter resets. Water-used forecasts normalize each usable interval to gallons per day, then display expected use per typical (median) reading interval; this is a horizontal estimate rather than a scheduled future reading. Future readouts are explicitly labeled Forecast and have no View Inventory action. Only recorded points appear in the recorded-values table, and no forecast values are written to inventory history.

## Chemical Order Planning

Chemical charts include an orange dashed reorder line, including when the forecast is hidden. The order panel uses the same recent net drawdown estimate independently of the Show Forecast checkbox. Salt and NWOS have no assumed order thresholds.

| Chemical | Reorder (gal) | Approximate Usable Capacity (gal) | Standard Delivery (gal) |
| --- | ---: | ---: | ---: |
| Alum | 4,000 | 17,250 (3 x 1,750 + 12,000 East) | 4,400 |
| Hypochlorite | 2,000 | 7,200 (2 x 3,600) | 4,500 |
| NaOH | 2,000 | 5,250 (3 x 1,750) | 4,000 |
| Polymer | 400 | 830 (300 tank + 530 stored) | 265 (1 tote) |
| Permanganate 20% | 400 | 830 (300 West + 530 stored) | 265 (1 tote) |

All deliveries use the operator-confirmed seven-day lead time. The East 10% permanganate batch does not count toward full-strength stock or storage capacity. Planning and calculation settings can be edited under Management > Chemical Settings. Saved inventory versions preserve historical calculations; current ordering settings drive new purchasing recommendations. See [Chemical Settings And Management](chemical-settings-proposal.md).

With sufficient positive recent drawdown, the panel estimates the threshold date and earliest total-capacity fit date. Target delivery is the later of those dates; Place Order By is seven days before that target. For example, a 4,000-gallon caustic delivery needs stock at or below 1,250 gallons to fit the 5,250-gallon total usable capacity. The panel explicitly flags this conflict with the 2,000-gallon reorder level so an operator can arrange a smaller load or coordinate the delivery date. Dates are based on the latest reading in the selected range, rounded to calendar days; an overdue order date is labeled Due Now. Less than seven estimated days of remaining supply triggers an alert. Flat or insufficient histories retain thresholds/capacities but produce no invented dates. Readings older than 14 days and volumes exceeding approximate capacity are flagged.

Headroom is an approximate aggregate estimate; individual tank distribution, heel-volume conventions, operating limits, and transfer arrangements must be checked before accepting a delivery. Stored tote readings, where present, show gallons and tote equivalents plus nominal storage headroom. A partially used tote still occupies a slot; the app does not infer a free position from fractional gallons. Imported total-only inventories cannot establish tote space. No purchase order, supplier notification, deliveries, or forecast records are created.

## Storage And Deployment

Records live in `chemicalInventory` within the existing persistent `/data/inventories.json` file, alongside supply inventory. The current catalog, supply counts, orders, and their history are preserved. Existing deployment backup/restore coverage includes the chemical records because it already covers this data file. Standard inventory history reset preserves chemical records; it does not erase them.

Endpoints: `GET /api/chemicals`, `PUT /api/chemicals/records/YYYY-MM-DD`, and `DELETE /api/chemicals/records/YYYY-MM-DD`. Writes require a matching global revision. Values must be finite, nonnegative JSON numbers (up to 1,000,000,000) or null. The server calculates totals itself rather than trusting browser totals.

Run `npm test` in `apps/operator-inventory` for formula and API coverage. Run `node apps/operator-inventory/test/chemical-browser.js` from the repository root for entry, preview, save/reload, history/delete, and responsive browser checks. Tests use temporary data only.

Deploy with the normal inventory deployment, for example `./deploy.ps1 -Target Inventory -Server gibbhub` from the repository root.

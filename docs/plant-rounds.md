# Plant Rounds

Open `/plant-rounds/` from Operations Home or the Apps menu. The app uses the shared Operations header, Inter font, teal controls, and mobile layout.

## Daily Workflow

The home page defaults to today's date in America/Denver. Choose the date, select an active operator, select AM or PM, and start or resume rounds. One AM record and one PM record exist per calendar date. Earlier dates can be opened from the same date picker.

Use the location dropdown or Previous/Next Location to move through the checklist. Numeric readings support decimals and zero; Yes/No observations require an explicit answer, while task checkboxes record completion. Clearing a checkbox returns the task to unrecorded. N/A is available for items that cannot be checked. The clarity score is an integer from 1 through 5, as specified on the sheet. Other inputs have no invented operating thresholds.

Every changed entry saves automatically, with operator name and timestamp. The save indicator distinguishes pending, failed, and completed saves. Complete Rounds is available at every location and becomes enabled when all required items have a saved answer or N/A, with no pending saves, conflicts, or invalid entries. Successful completion returns to Rounds Home, updates the daily summary, and shows a dismissible confirmation naming the completed shift and date. Failed completion keeps the operator in rounds with an error; no success message is shown. Completion is protected against duplicate clicks. Editing a completed round reopens it.

PM rounds show the date's AM values beside PM inputs. Saved AM readings use compact gray reference panels; editable PM controls have a pale teal background, a strong teal border, and an explicit PM Entry label on both desktop and mobile. AM per-item attribution is available on hover to reduce repeated text. AM-only items remain visible as read-only context; PM-only items have no AM value. Separate devices refresh shared records every 15 seconds and when the page becomes visible again. This is server storage, not a browser-only checklist.

The Notes button is always available, including on the home page and while scrolling. Notes retain date, AM/PM, location, operator, and creation time. Both shifts can read the day's notes. Edit and Delete controls appear inside the Notes window. Editing keeps the original date, AM/PM, and creator, and records the editor and edit time. Saved edits close the window; failed saves preserve the text. Deleting requires confirmation and leaves an audit record with the removed note. Per-note revisions prevent stale edits or deletions, including on notes created before revisions were introduced. Operator names identify entries; they are not authenticated signatures.

## Drawdown Reference

The small graduated calibration-column icon beside the floating Notes button opens **Flows And Feed Rates** from Rounds Home or any rounds location. It has an accessible name and tooltip. Enter Plant Influent Flow and Total Filter Flow in MGD, and Alum, Polymer, NaOH, Sodium Hypochlorite, and Sodium Permanganate feed rates in mL/min. Inputs accept nonnegative decimals, including zero; a blank means unknown/not recorded.

Choose an active operator and **Save Values**. Values belong to the selected rounds date and AM/PM shift, shown at the top of the panel. In an active round, that round fixes the date/shift; from Rounds Home, the date picker and AM/PM selection choose them. Each new day and shift starts blank. Operators opening the same date and shift share those saved values. The panel stays open for reference while performing drawdowns and displays who last saved the values and when (America/Denver).

**Reload Saved Values** refreshes the current round's values, with confirmation before discarding an edited draft. A stale save is rejected rather than overwriting another operator's update. Unsaved drafts are stored separately by date and shift on the device and restored only when reopening that same set of rounds.

Values persist inside **data/plant-rounds/YYYY-MM-DD.json**, under shifts.AM.drawdownReference or shifts.PM.drawdownReference. Changes are recorded in the daily audit history and covered by the existing persistent volume and deployment backup. GET/PUT /api/plant-rounds/:date/:shift/drawdown-reference read/save these values with revision checks and an active operator. Opening an empty round does not create a record; saving reference values creates/updates that shift's record. Editing reference values on completed rounds reopens that shift, like editing a reading. The PDF checklist layout is unchanged.

The older unscoped drawdown-reference.json and local draft are retained but never imported into a date or shift. The old unscoped API returns a reload-required response so cached clients cannot keep sharing values across rounds.

## Users

Choose **Users** in Plant Rounds navigation or **Apps > User Management** to manage the [shared Operations directory](operations-users.md). First and last name are required. Initial active users are Blaine Alward, Carson Conlin, Kyle Heckman, John Colmey, Zak Brennnecke, Ted Strickler, and Gene Hutson (names preserved as supplied). There are no logins, passwords, or administrator roles.

Choose **Set Inactive** to remove someone from operator selection. This is a soft removal: their permanent user ID, name, and record remain in users.json. **Show Inactive Users** reveals these records and **Reactivate** makes them selectable again. Duplicate full names (including inactive users) are rejected to avoid creating replacement records for the same person. Users can also be renamed; existing rounds and notes retain their originally recorded names.

Rounds Home, Notes, and Manage Items use dropdowns containing only active users. The most recently selected active operator is remembered on that device. User lists refresh on page load, returning to the tab, and reconnecting. The API rejects new changes attributed to inactive or unknown names. If a user is deactivated during an open round, unsaved changes remain on that device; reload, select an active operator, and resume the same date and shift to save them.

The directory and change history persist in **data/plant-rounds/users.json**, covered by the existing persistent volume and deployment backup. New entries, notes, shifts, and audit events include a permanent user ID alongside the recorded display name. Legacy records retain their original names without rewriting historical data. User changes use revision checks and atomic writes on the shared write queue. GET/POST /api/plant-rounds/users and PUT /api/plant-rounds/users/:id manage users; DELETE on the user endpoint sets inactive and never physically deletes the record. User-list management remains accessible even if everyone is inactive, so an operator can be reactivated without a login.

## Manage Items

Choose **Manage Items** in the Plant Rounds navigation. Select your operator name, then use **Add Item**, **Edit**, or **Remove**. Filter the list by location or search by name/section. In the item form, the Section dropdown lists existing sections for the selected location. Choose New Section to enter a new name; newly saved sections become available in the dropdown for that location. Items support Number, Checkbox, Yes/No, and Text inputs; a location; an existing or custom section; AM, PM, or both; and required/optional status. Number fields can have an optional unit, shown beside the label in rounds and the PDF. Item names and units are stored separately: for example, West Tank Level plus unit in, and Skid Pressure plus unit psi. Known parenthetical units are extracted when loading existing managed checklists or saving an item. Yes/No items omit redundant Y/N parenthetical text (including spacing and Yes/No variations). Descriptive parentheses such as Leaks (Water/Chemicals) remain part of the name. Removal requires confirmation.

Changes apply to **new daily records**. The first saved action for a date (starting rounds, entering a reading, or saving a note) stores that date's checklist snapshot. Both AM and PM use that same snapshot. Existing dates, including incomplete ones, retain their original items, types, schedule, progress totals, and PDF labels. Removed items and readings remain in those saved records. For dates saved before this feature, the first management change freezes their existing checklist before saving the change. Opening a blank date or PDF alone does not freeze or create a record.

The shared checklist and its change history are stored in **data/plant-rounds/checklist.json**, inside the existing persistent volume and deployment backup. Each change records the operator, timestamp, action, and previous item. Concurrent stale changes are rejected; Refresh loads the latest list. Checklist writes share the daily-record write queue and replace files atomically. Invalid stored data blocks the change instead of replacing it. The app loads its checklist from the API; the bundled template.json is the initial default only. Once a managed checklist exists, redeploying preserves it.

Management uses the same active-user selection as rounds, with no separate administrator login. Item APIs are POST /api/plant-rounds/items and PUT/DELETE /api/plant-rounds/items/:id, with the checklist revision and operator name required. New items have permanent generated IDs; IDs are retained during edits. Locations remain the existing 19 locations.

## Rounds History

Choose **History** in the left navigation (tabs on mobile). It opens a read-only monthly calendar, defaulting to the current month in America/Denver. Select any date to open its AM/PM PDF in a separate tab, including partial rounds. A teal dot marks dates with saved records; unmarked dates open a blank sheet without creating a record. Use the month picker or previous/next arrows for older rounds.

Saved records for the selected month appear newest first below the calendar, with AM/PM operator names, completion status, and check counts. **View Rounds PDF** reviews the saved sheet; **Edit Rounds** opens the selected date on Rounds Home, where an operator must explicitly start/resume AM or PM. Navigating from active rounds to History first saves pending entries and blocks navigation if a save fails or an invalid entry needs attention.

`GET /api/plant-rounds/history?month=YYYY-MM` returns monthly summaries without entry values or audit history and never changes records. A storage/read error is shown explicitly rather than presenting missing records as an empty calendar.

## PDF Preview

Choose **View PDF** beside the daily summaries on Rounds Home or in the current rounds heading. The preview includes both AM and PM for the selected date. It is available before either round is finished, including for a completely blank date and without entering an operator name on the home page. Current entries are saved before opening the preview; a save error or unresolved entry conflict must be resolved first.

The report uses a compact three-column layout on landscape US Letter paper. Standard blank, partial, and completed daily records with ordinary notes fit two pages. Location bars include the AM/PM column headings; the source checklist's subsections and confirmed units are preserved. Blank cells mean not recorded; shaded cells with a dash mean not scheduled. Yes/No, Done, N/A, and numeric zero remain distinct. Each page shows the date, operators, progress, completion state, and generation time. Incomplete records are labeled **PARTIAL / IN PROGRESS**; untouched dates are labeled **BLANK / NOT STARTED**. Generating a report never completes or otherwise modifies rounds.

Field comments are referenced from their table cells and printed in full with the day's shared notes in the remaining report columns. Unusually long notes continue onto extra columns/pages only when necessary; text is never cut off to enforce a page limit. PDFs contain saved current notes, including edit attribution, and exclude deleted notes. All report times use America/Denver. The printable report uses locally embedded Inter fonts and requires no font or PDF-service network calls.

The preview opens in a separate tab with **Refresh PDF**, **Download PDF**, and **Open PDF**. Refresh generates a new saved-record snapshot. Open PDF is also available for mobile browsers that cannot display an embedded preview. The API endpoint is `GET /api/plant-rounds/YYYY-MM-DD/report.pdf`; `?download=1` changes the response to an attachment. Email delivery can be added separately.

The API uses PDFKit; PDF.js and the canvas renderer are development-only dependencies for export verification. Static PDF font files and their license/provenance are in `assets/fonts/pdf/`, copied into the API image by the Dockerfile.

## Spreadsheet Mapping

Source: `Blank Daily Rounds Checklist.xlsx`, worksheet **Rounds Sheet 2026**. The older **Original** worksheet is not used. The workbook's existing date/operator examples were not imported as rounds data. The supplied workbook remains unchanged.

`apps/plant-rounds/template.json` contains 19 locations and 132 fields: 57 numeric readings, 42 Yes/No observations, 32 completed-task checkboxes, and one optional text area. There are 130 required AM items and 100 required PM items. Fields preserve source cell addresses as stable IDs. Chemical Building and Rapid Mix / Floc retain their subsections. Source spelling for clarity/clarifier was normalized for readability.

Raw Water Turbidity (NTU), East/West Clarifier Turbidity (NTU), and Raw Water pH accept decimal readings in both shifts. pH has no unit suffix. Earlier checkbox values for these fields remain in storage/history but display as unrecorded and do not count toward completion; operators must enter actual readings.

The visible entry boxes immediately to the left/right of each label define AM/PM applicability. Cell existence alone is insufficient: some cells only draw part of a blank area's outline, while others inherit their entry-box borders from adjacent cells. The audit accounts for those shared borders, the merged CW Sample Pump label/entry height, and the blacked-out PM sludge-level cell O26. Examples include AM-only tank levels B7/B8/B9, AM-only Flush PAC Pump R2, and PM-only Outside Lights Check J39. The East Clarifier oil check J9 is scheduled for both AM and PM per operator instruction. Alum, polymer, hypochlorite, permanganate, and NaOH tank levels are AM-only; PM operators see the saved AM readings without a PM input. The gravity-thickener Comments area is an optional text entry. The pump-room Equipment Notes / Out Of Service field has been removed; use the persistent Notes button for equipment observations. Previously saved entries remain in stored records and audit history.

### Schedule Audit — October 24, 2026

Rechecked all 132 active fields against **Rounds Sheet 2026** in the original workbook, including cell-border formatting. The following additional corrections were applied:

| Location | Check | Correct Schedule | Source |
| --- | --- | --- | --- |
| Floc Vault | Flush RM pH Probe | AM Only | F33 |
| Floc Vault | Clean Y-Strainer | AM Only | F37 |
| Streaming Current | Flush SCM | AM Only | F40 |
| East Clarifier | Oil Sheen; Clarity | AM Only | J3, J4 |
| West Clarifier | Oil Sheen; Clarity | AM Only | J13, J14 |
| Waste Ponds / Reclaim | Clean Y-Strainer; Collect Standley Sample | AM Only | J36, J37 |
| Dewatering Building | Toe Drain Flow | AM Only | N22 |
| Gravity Thickener | Oil Sheen | AM Only | N25 |
| OPS Area | Check LZ/HZ/BPS Flows | AM And PM | N19 |

The resulting required totals are **130 AM / 100 PM**. Saved readings and audit history are retained. Checks removed from PM no longer block PM completion, and their AM values remain visible during PM rounds. API checks assert the full audited schedule, including the operator-requested overrides.

Pressure readings use labels such as Skid Pressure (psi), Chase Water Pressure (psi), and HZ/LZ Pressure (psi), with psi stored as the unit. This naming correction also applies when loading an existing managed checklist; saved daily checklist snapshots remain unchanged.

Units are preserved where the sheet states them. Operator-confirmed additions: Total Filter Flow is MGD; chlorine readings, including the CL-17 reading, are mg/L; North/South Pond Levels are feet (ft) in both OPS Area and Waste Ponds / Reclaim. Other unstated units remain unspecified. Field IDs and stored numeric values are unchanged.

## Storage And Recovery

The existing suite API handles `/api/plant-rounds/`. Daily JSON records live at `/app/data/plant-rounds/YYYY-MM-DD.json`, inside the suite's persistent `./data:/app/data` mount. `PLANT_ROUNDS_DATA_DIR` can override the directory. Entries, shared notes, completion state, and edit history persist across rebuilds. The deployment script backs up this directory alongside the equipment-board state. Regular external backups should include the suite data folder.

Writes are serialized and replace files atomically. Per-entry revisions reject stale edits with a visible choice between the saved value and the operator's proposed entry; changes to different fields do not replace one another. Numeric zero and explicit No are stored as answers. Invalid or corrupt existing records return an error and are never silently reset.

Unsent entries are retained in local storage by date and shift, with their original revision. After reconnecting or reopening the same rounds, they retry and still check for conflicts. A failed save is never labeled saved. Note text drafts are also retained locally; repeated note submissions in the same session use an idempotent identifier. Storage-disabled browsers warn that drafts cannot be retained. Shared reads and writes require the API; this is not a fully offline application.

## Local Use And Checks

Run `npm start` for the API, then `node dev-server.js` in another terminal and open `http://localhost:8080/plant-rounds/`. The development server proxies rounds requests to port 3001 (override with `API_PORT`). Opening with a static-only Live Server can show the page but cannot save shared records.

Run `node scripts/check-plant-rounds-api.cjs`, `node scripts/check-plant-rounds-pdf.cjs`, and `node scripts/check-plant-rounds.cjs`, or `npm run check:ui -- rounds-api rounds-pdf rounds`. Checks use temporary data, test real AM/PM handoff between browser sessions, mobile widths, shared notes, conflict resolution, draft recovery, validation, restart persistence, record corruption protection, actual PDF parsing/rendering, full report text, pagination, and preview/download behavior. They do not modify production data.

Use the existing suite deployment after reviewing locally:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Target Suite -Server gibbhub
```

No separate container or new port is needed. Deploy the Inventory target separately if its packaged Apps menu also needs the new Plant Rounds link.

# SOP Creator

Create procedures in the Operations theme, using the supplied Word document's section order: Purpose, Background, Notes, Security Concerns, Equipment, and Procedure. The source document's operational details and screenshots are not bundled with the app.

The editor supports procedure section headings, continuously numbered steps, lettered substeps, captioned photos, and reordering. Photos are resized to a maximum 1,600-pixel dimension before saving. Empty context sections are omitted from the document. Desktop shows editor and preview together; smaller screens switch between them. Print / Save PDF prints the document alone on Letter paper; turn off browser headers/footers for a clean PDF.

Save SOP writes to the shared server library (`data/sops`, or `SOP_DATA_DIR`). Edits are also kept in IndexedDB in the current browser as a recovery draft. The library is not an approval or signature system. Prepared By and Approved By are descriptive fields. Conflicting saves preserve the current draft instead of overwriting a newer server revision. Previous server revisions are retained under `data/sops/history`. Include this directory in server backups.

On desktop, Hide Preview (or the preview's close button) gives the editor the full width. Show Preview reopens it. The Preview Width slider adjusts the split between 35% and 65%; these layout preferences are remembered in the browser. They do not change document formatting or the printed PDF. On mobile, closing the preview returns to Edit SOP.

Open Preview Window opens a separate document window that updates live from the editor, including unsaved changes and photos. Move it to another monitor or print from that window. If the editor closes, it retains the last received preview. Allow pop-ups if the browser blocks the window.

Procedure photos are centered in a consistent 180-pixel-high frame (1.875 inches in print), without cropping. Multiple photos are arranged two per row, with captions beneath each image. Additional photos wrap onto new rows.

Each step can include tables through Add Table. Edit headers and cells directly, add or remove rows and columns, set an optional caption, and reorder or remove tables. Each table supports up to 8 columns and 50 data rows, with up to 6 tables per step. Table editors scroll horizontally on small screens. Tables are saved with the SOP and included in recovery drafts, backups, the live preview, the separate preview window, and PDFs, with repeated column headers when printed across pages.

Procedure writing fields expand as you type. Enter splits the current entry at the caret and creates the next numbered step or lettered substep; Shift+Enter inserts a line break. Ctrl/Cmd+Enter moves to the next step, creating it if needed. At the beginning of a plain step with no photos or substeps, Tab indents it beneath the previous step in the same section. Shift+Tab at the beginning of a substep promotes it to a step, preserving subsequent substeps beneath it. Enter on an empty substep returns to numbered steps. Alt+Up/Down moves between instruction fields. Other Tab presses retain normal focus navigation, and Add Step / Add Substep remain available.

Import / Backup exports editable JSON with photos. Imports create a new document and do not overwrite an existing SOP. Word import is not supported. Unsaved edits trigger a prompt before opening another SOP or starting over. Downloads occur only when Download SOP Backup is clicked.

SOP Tags provides a curated water-treatment list grouped into Treatment Processes, Instrumentation & Water Quality, Chemicals, Tasks, and Systems & Safety. Choose up to 20 tags, such as pH, Calibration, and Instrumentation. Tags are saved with the SOP, included in backups, and shown on library cards; they do not add clutter to the printed procedure. The library supports tag filtering (including Untagged), clicking a tag chip to filter, searching tags alongside titles and teams, and sorting by tags, title, revised date, or last saved time. Older SOPs start untagged.

SOP Library opens `library.html` as a full page listing all saved procedures, with search, tag filters, sorting, Refresh, New SOP, and Return To Editor. Filter and sort choices are reflected in the library URL. Opening the library keeps the current editing draft in the browser; returning to the editor restores it. Opening another saved SOP or creating a new one prompts before replacing unsaved changes. Library document links use `?sop=<id>`; these open the existing saved SOP rather than creating copies.

Each library card has Edit SOP and View SOP. Edit opens the saved procedure in the editor. View opens `preview.html?sop=<id>` in a new window, loading the saved SOP directly in a read-only document view with Print / Save PDF. It refreshes independently of the library, never reads or replaces the browser's editing draft, and does not save changes. The editor preview and saved view use the same document renderer so photos, tables, dates, and layout match.

Revision History is an editable table at the end of the SOP, containing revision date, change summary, revised by, and approved by. Add, edit, reorder, or remove entries in the editor; they are saved with the SOP and included in previews, PDFs, and backups. Empty tables are omitted. Entries are maintained manually; saving does not issue a revision or verify an approval. The document header shows Revised Date instead of a version number, automatically using the latest valid date in Revision History regardless of row order. When no dated entry exists, it shows Not Recorded. Dates identify revisions; revision numbers are not used. Existing entries keep their dates and change details when opened.

The app uses the suite's existing access model; no new authentication is introduced. Deployment follows the repository deployment instructions.

Checks:

```
node --test scripts/sop.test.cjs
node scripts/check-sop-creator.cjs
```

Library cards show Needs Review when the latest revision, review, or effective date is more than one calendar year old, or no such date is recorded. The exact anniversary is not overdue; February 29 anniversaries fall on February 28 in non-leap years. Save timestamps do not reset review reminders. Add History Entry offers Revision or Review - No Changes; record the date and reviewer and save the SOP. Older history entries remain revisions. Reviews appear in the printed history and Reviewed Date metadata without changing Revised Date.

History entries also support Creation. Selecting Creation fills an empty or N/A summary with SOP Created; custom summaries stay editable and are preserved. Creation entries appear by name in previews and PDFs and count toward annual review dates. Existing history entries are unchanged.

Saved View SOP and the separate preview window adapt to phone widths: smaller page margins, readable body text, contained photo rows, proportional photo heights, and one-column equipment lists. Photo pairs stay together, with additional photos in subsequent centered rows. These screen adjustments do not change the printed layout or fixed print photo height.

Library cards include Delete SOP. The confirmation dialog displays the exact title and requires typing DELETE (case-sensitive). Cancel and Escape leave the SOP intact. The server independently checks the confirmation, title, and last-saved timestamp; a changed SOP requires refreshing and confirming again. Deletion removes the SOP from the active library and saved views while retaining its last record in data/sops/deleted and prior backups in data/sops/history. Include both in server backups. An older editor cannot recreate the deleted ID; recovery drafts can be downloaded or imported as a new SOP.

List/grid layout mockup: previews/library-layouts.html. This standalone preview contains a snapshot of library titles, tags and dates, a remembered list/grid toggle, search/tag/review filters, and sorting. View SOP opens saved documents; New, Edit and Delete are demonstration actions with no server mutations. The production library is unchanged.

# SOP Creator

Create procedures in the Operations theme, using the supplied Word document's section order: Purpose, Background, Notes, Security Concerns, Equipment, and Procedure. The source document's operational details and screenshots are not bundled with the app.

The editor supports procedure section headings, continuously numbered steps, lettered substeps, captioned photos, and reordering. Photos are resized to a maximum 1,600-pixel dimension before saving. Empty context sections are omitted from the document. Desktop shows editor and preview together; smaller screens switch between them. Print / Save PDF prints the document alone on Letter paper; turn off browser headers/footers for a clean PDF.

Save SOP writes to the shared server library (`data/sops`, or `SOP_DATA_DIR`). Edits are also kept in IndexedDB in the current browser as a recovery draft. The library is not an approval or signature system. Prepared By and Approved By are descriptive fields. Conflicting saves preserve the current draft instead of overwriting a newer server revision. Previous server revisions are retained under `data/sops/history`. Include this directory in server backups.

On desktop, Hide Preview (or the preview's close button) gives the editor the full width. Show Preview reopens it. The Preview Width slider adjusts the split between 35% and 65%; these layout preferences are remembered in the browser. They do not change document formatting or the printed PDF. On mobile, closing the preview returns to Edit SOP.

Procedure photos are centered in a consistent 180-pixel-high frame (1.875 inches in print), without cropping. Multiple photos are arranged two per row, with captions beneath each image. Additional photos wrap onto new rows.

Import / Backup exports editable JSON with photos. Imports create a new document and do not overwrite an existing SOP. Word import is not supported. Unsaved edits trigger a prompt before opening another SOP or starting over. Downloads occur only when Download SOP Backup is clicked.

The app uses the suite's existing access model; no new authentication is introduced. It is not deployed automatically.

Checks:

```
node --test scripts/sop.test.cjs
node scripts/check-sop-creator.cjs
```

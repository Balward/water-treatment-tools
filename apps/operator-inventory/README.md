# Operator Inventory

A phone-focused web app seeded from `Operators Inventory - ALL.xlsx`. Home offers **Operating Supplies** (40 items), **Janitorial Supplies** (18 items), and **Dewatering Inventory** (14 items). Only the first three worksheets are imported; the final two order worksheets are ignored completely. The interface stays in a single phone-width column, including on a desktop.

Under **New Inventory**, tap a worksheet, choose a date and enter your name. Each inventory contains only that worksheet's items and locations. New count fields start blank. Each card shows **Previous** from the latest completed inventory of the same worksheet (by inventory date, then completion time), where the description, count size, and location still match. Drafts are ignored as reference sources. Type today's quantity using the decimal keyboard. Previous quantities are references only; there are no arrow or copy buttons. Use the keyboard's **Next** key to move to the next item. The app fits its height to the visible screen while editing, scrolls the focused field above the keyboard, and temporarily hides the bottom navigation when the keyboard reduces the available space. The location picker stops sticking while the keyboard is open; progress counters remain at the top. A blank is uncounted; an explicitly entered zero is counted. Previous quantities alone never advance progress or satisfy completion. Existing drafts keep their saved counts; create a new inventory to use the blank-field workflow. Counts save automatically, and the completed source record remains unchanged. The top counters and compact bottom navigation stay outside the content scroll area. Items stay in worksheet order, with no search field. Completing requires every current item count and makes the record read-only. Counts at or below PAR are flagged for review; this version does not place orders.

On startup, the app permanently deletes old combined inventories from storage. Separate worksheet inventories and their counts are retained.

White Rags has no count size and its PAR is “Fill As Needed” in the workbook. The app preserves those omissions and shows a manual review status rather than inventing a numeric threshold. Inventory records include a snapshot of the catalog so historical units and PAR values remain intact when the catalog changes.

## Local use

Requires Node.js 22 or newer. Nodemailer handles SMTP; there is no frontend build step.

```powershell
cd apps/operator-inventory
npm ci
npm start
```

Open `http://localhost:3080`. Saved records are stored in `data/inventories.json`. Set `PORT` and `DATA_DIR` to override defaults. Run `npm test` for catalog and API lifecycle checks.

An optional browser check is available with `node test/mobile-browser.js`. It uses headless Chrome (set `CHROME_PATH` if needed), isolated temporary data, and checks 320/390/430px layouts, worksheet workflows, and focused-field visibility with simulated layout-resizing and overlay keyboards. This does not replace testing the actual keyboard on a physical Android device. Screenshots are saved in the ignored `preview/` folder.

## Unraid / Docker

For the step-by-step setup on 192.168.0.88 and your Nginx Proxy Manager at inventory.gibbhub.io, see [UNRAID-SETUP.md](UNRAID-SETUP.md).

This app has its own container and does not require the existing water-treatment-tools proxy, external Docker network, or API keys.

From this directory on your server:

```sh
mkdir -p /mnt/user/appdata/operator-inventory
chown 1000:1000 /mnt/user/appdata/operator-inventory
docker compose up -d --build
```

Open `http://YOUR-UNRAID-IP:3080`. The Compose file binds `/mnt/user/appdata/operator-inventory` to `/data`, so inventories survive container replacement. The image runs as Node's non-root user, UID/GID 1000; the host folder must be writable by that user.

For the Unraid Docker UI, build the image first with `docker build -t operator-inventory:latest .`, then add a container:

| Setting | Value |
| --- | --- |
| Repository | `operator-inventory:latest` |
| Network type | Bridge |
| Container port / host port | `3080` / `3080` (TCP) |
| Container path / host path | `/data` / `/mnt/user/appdata/operator-inventory` |
| WebUI | `http://[IP]:[PORT:3080]/` |
| Timezone | `TZ=America/Denver` |

Back up the appdata folder. Use one container instance for this data directory; writes are atomic and concurrent edits to the same draft are rejected using revision checks. On a conflict, the UI keeps the unsaved values visible for reference and asks you to reload the latest version. On a storage/network error, retry saving before leaving. This initial version has no login and is intended for your trusted local network.

## Refreshing the catalog

On Windows, re-run the included importer and rebuild the container:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./import-workbook.ps1 -Workbook 'C:\path\Operators Inventory - ALL.xlsx'
```

The importer reads workbook values and external product hyperlinks, carries merged location headings down their item rows, and preserves descriptions, count sizes, PAR, supplier, item number, and case size. Existing inventory snapshots stay unchanged.

## Order Needed report

Completing an inventory opens its Order Needed report automatically. Each card in History and Recent inventories also has a report button, including a clearly labeled draft report for unfinished counts. The report uses the saved inventory's item details and counts, so later catalog changes do not alter historical results.

Items with entered quantities at or below their numeric PAR are listed in worksheet order with location, on-hand quantity, PAR, count size, and supplier details. Blank counts are excluded and draft reports show how many items remain uncounted. Items with nonnumeric rules such as Fill As Needed appear separately under Review as needed. PAR is a trigger, so the report does not calculate an order quantity or send orders.

## Email reports

Each Order Needed report has a recipient field and Send report by email button. Set `SMTP_USER` and `SMTP_PASSWORD` in the Unraid source folder's `.env` and recreate the container to enable it. Defaults are Namecheap Private Email (`mail.privateemail.com`, TLS on port 465); port 587 requires STARTTLS. `EMAIL_DEFAULT_TO` can prefill a recipient. See [the email setup instructions](UNRAID-SETUP.md#optional-email-order-needed-reports).

The server builds the email from saved inventory counts and snapshots. The HTML version uses a table with item, location, on-hand quantity, PAR, count size, and supplier/product details; manual-review items have a separate table with their rule. Product numbers link to the saved product page when an HTTP or HTTPS link is available; otherwise they remain plain text. Approved item photos appear beneath the item name as embedded inline attachments, so recipients do not need access to the inventory app. Items without photos keep text-only rows. Email clients may hide images or lack support for some image formats. It also includes a plain-text version, marks drafts clearly, and never sends automatically. Invalid addresses and stale reports are rejected, and sends are limited to one every 30 seconds. SMTP credentials are kept out of the browser, Git, and Docker image. Success indicates SMTP acceptance; verify actual delivery in the recipient inbox. Local SMTP use requires environment variables supplied by your shell; `npm start` does not load `.env` itself. Tests use mock senders and do not send actual email.

## Deleting inventories

History and Recent inventories include a trash button for each draft or completed inventory. A confirmation popup identifies the worksheet, date, and operator before permanent deletion. Cancel keeps the record. Deleted completed inventories are excluded from previous-count references for future inventories; existing inventories retain their saved reference snapshots. If a record changes after confirmation opens, reopen the popup to review it before deleting.

## Product photo preview

Product photos are enabled. The UI displays only photos tagged `workbook-link` or `user-provided` in the image manifest. Photos found through additional product-number searches remain stored but hidden.

The current bundle displays 40 photos for Operating Supplies: 18 from the original workbook-link import and user-selected photos for Methyl Purple Indicator, pH 7.00 Buffer, pH 10.01 Buffer, Sulfuric Acid, 0.02N, EDTA Titrant 0.01M, Large 3 mil gloves, XL 3 mil gloves, Kim Wipes, Waffle Print Tissues, Sulfuric Acid Dropper Bottle 5.25N, Alkaline Cyanide Reagent, Salt Bridge Solution, RoVer Rust Remover, Salt Bridge for DPD1P1 PEEK, CL-17 Colorimeter (analyzer reference photo), Crush Tube Large, Crush Tube Small, Black 5 mil Nitrile Gloves LG, Black 5 mil Nitrile Gloves XL (shared glove reference photos), Hydrogen Peroxide, Vinegar, and the 10-inch Filter Cartridge. Two additional search results remain hidden. Compact thumbnails appear next to the item name; tapping one opens its product page. Items without an approved photo keep their normal card layout. Photos do not fill counts or affect progress, and existing drafts can display photos when their name and item number match the catalog.

The workbook contains 37 product links across its first three sheets, and none for Janitorial Supplies. Some links are obsolete or block automated requests. The user confirmed 5.25 N for the acid dropper item and supplied its packaging photo. Its thumbnail opens that selected image rather than the workbook link, which describes 19.2 N. The user explicitly selected the supplier packaging photo for Alkaline Cyanide Reagent after reviewing its different bottle label. Supplier packaging can change; photos are a reference and may show a product family.

To refresh photos from the imported catalog, run this locally with Node 22 or newer and internet access:

```sh
node scrape-images.js
```

The importer checks product metadata, downloads supported raster images into `public/images/`, and records product page, image URL, item number, source type, and download date in `public/images/manifest.json`. It also checks additional supplier pages listed by item number in `image-sources.json` and Northwest Scientific's catalog-number lookup, independently of workbook links; those results are tagged `additional-search` and hidden. Existing downloads are retained; unsuccessful links and items without links are recorded in `image-import-report.json`. It makes at most two concurrent requests and does not run while staff count inventory. Rebuild the container after importing images. The Docker image includes the photo files; no image API keys or external image requests are needed by phones.

To add a user-selected direct image link, identify the item's ID in `catalog.json`, then run:

```sh
node import-image.js s1-r5 'https://example.com/product-photo.jpg'
```

This replaces that item's photo, validates the image format and size, and tags it `user-provided` so it appears in the UI. Use a direct JPEG, PNG, WebP, or GIF link rather than a product page.

## Appearance

The mobile UI defaults to charcoal dark mode with restrained Northglenn teal (#00677F), green (#84BD00), gold (#F2A900), and red-orange (#CF4520) accents. Use the Light mode / Dark mode button in the bottom dock to switch; the preference is saved on that browser. Neutral cards keep product photos and quantities easy to read.

## Manage inventory items

On Home, tap Manage items and choose a worksheet. Edit an existing item, or tap Add item. Enter a name, location (select an existing location for the worksheet, or choose Add new location and enter its name), and count size. PAR accepts decimals; leave it blank for manual replenishment review. Supplier, product number, pack size, replenishment note, and product-page link are optional. Remove asks for confirmation. New items appear at the end of the worksheet catalog, grouped by their location during counting.

Changes apply to new inventories only. Existing drafts, completed inventories, counts, and order reports retain their saved item snapshots. Item changes are saved in /data/inventories.json alongside inventory records, so the existing Unraid volume preserves them through container rebuilds. After the first edit, the saved catalog takes precedence over the bundled workbook catalog. Back up this data file to preserve both counts and item settings.

Anyone who can access the app can manage items; separate administrator accounts have not been added. Editing an item name or product number can hide its existing photo because photos require matching catalog metadata. Photo uploads are not part of this screen yet.

The header uses the supplied City of Northglenn horizontal logo on a white background in both themes, with Water Treatment Facility identification. The original logo is stored in public/branding/northglenn-logo.png and included in the Docker image.

## Automated deployment

Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\apps\operator-inventory\deploy.ps1` from the repository root to test, package, upload, and rebuild on Unraid. Add `-PackageOnly` to package without contacting the server. See UNRAID-SETUP.md for prerequisites and backup behavior.

## Pack-size convention

Inventory entry asks staff to double-check unusually large changes from the previous completed inventory before saving. A change must be at least two count units and either reach three times the previous count, drop to one quarter or less, or rise from zero to at least ten. Missing previous counts do not trigger a prompt. The check waits until staff leave the field, and offers Use this count or Edit count. Confirmation applies only to the entered value; changing it triggers a fresh check. This is an entry safeguard, not an ordering rule.

Pack labels use contents / package, such as 500 mL / bottle, 10 L / cubetainer, 10 boxes / case (250 gloves / box; 2,500 total), and 10 tubes / pack. Volumes use mL or L, weights use g, package names are lowercase, and large quantities use commas. Single-piece supplies use 1 plus the item type. Counting quantities, PAR levels, and counts are preserved; a supplier pack is not automatically treated as a counted case. Missing worksheet pack sizes remain unspecified.

The reviewed labels are shared by the catalog API, item editor, inventory cards, order reports, and email reports. They also format old snapshots for display without rewriting saved inventory records. Only exact reviewed workbook values for matching items are formatted; custom pack-size edits take precedence. Original workbook values and source/review notes are in pack-size-review.json. The user confirmed Cubetainer for the 4 L buffers, 0.02N sulfuric acid, and EDTA; 2,500 gloves per Large case (250 per box) and 2,250 per XL case (225 per box); and a 1 L bottle for 5.25N sulfuric acid. Single-container count label changes preserve previous-count references and never convert quantities. The user confirmed one box contains 20 buffer singlets. Its count unit is Box, to distinguish a full box from an individual singlet packet. Previous Case and Pack labels retain their count references.

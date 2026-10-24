# Northglenn Operations Design System

The source of truth is `shared/operations/`. Inventory, Equipment Status Board, Operations Home, Alum Hydrometer Conversion, Plant Flow, Water Data Explorer, RoboJar Analyzer, Sodium Hypochlorite Calculator, Permanganate Dose Predictor, Class A Training Videos, Water Treatment Flashcards, and the Regulation 100 Study Guide use the same locally served font, tokens, and Apps menu. Other tools retain their existing presentation until each is migrated and checked.

## Typography

Use **Inter** throughout the interface. A second UI font is unnecessary: size, weight, spacing, and contrast provide the hierarchy. Use tabular numbers for counts and status totals. A monospace font is reserved for actual code or diagnostic output, not ordinary labels.

| Role | Size | Weight | Use |
| --- | --- | --- | --- |
| Page title | 38px desktop / 32px phone | 700 | The primary page heading |
| Section heading | 24px | 700 | Dialog titles and major sections |
| Subheading | 20px | 700 | List and section headings |
| Card title | 16px | 700 | Inventory and application cards |
| Body | 14px | 400 | Descriptions and ordinary text |
| Secondary text | 12px | 400 | Supporting details |
| Label | 11–12px | 500 | Field labels and metadata |
| Control | 13–14px | 600 | Buttons and navigation |

These are baseline roles, not a rule that every card must have the same dimensions. The equipment board uses larger equipment names and explicit row sizing for reading from a distance. Inventory retains large quantity inputs and the physical dimensions of printed bin cards. Use Title Case for navigation, headings, and control names; preserve supplier/product capitalization, abbreviations, chemical names, and user-entered text. Descriptive text uses sentence case.

## Color and shape

- Ink `#172127`; secondary text `#576B77`.
- Primary action/accent `#00677F`; soft accent `#EDF5F7`.
- White surfaces, canvas `#EEF2F4`, borders `#BDCBD1`.
- Dark local navigation uses the same ink color, with teal for the selected item.
- Controls have a 6px radius; cards have an 8px radius.
- Spacing uses a 4px base: 4, 8, 12, 16, 24, and 32px.
- Touch controls are at least 44px high. Focus indicators remain visible.

Equipment status colors remain semantic and distinct: green in service, yellow warning, red out of service, blue maintenance, gray offline. Keep symbols alongside colors. Availability does not imply that equipment is currently running. The wall display has its own dark surroundings; inventory and Operations Home keep the approved light presentation.

At desktop widths of 900px and above, Equipment Status Board fills the viewport height. `desktop-layout.css` divides the available space into four equal equipment rows after the header, legend, comments, and footer. High Zone and Booster Pumps share one row (four cards in each group, eight across), retaining separate headings. On desktop, the editor's Add Comment action sits alongside the comments heading, and full comment messages remain available in the scrolling list. General Comments reserves 22% of the viewport height (120?300px) and scrolls within its list, leaving its heading and action visible. Tile and heading sizes adapt to height; notes use only complete lines that fit, up to three, and remain available through equipment details. Comments scroll within their panel. Short windows must keep all equipment names and status symbols visible rather than reserve fixed space for notes. Phone layouts keep their normal page scrolling.

## Shared navigation

Desktop sidebars use the shared `--ops-sidebar-*` tokens: 222px width, 54px navigation rows, 6px between rows, and 32px/14px/24px outer padding. Home and Inventory share 22px icons and 13px navigation text. Both switch away from the desktop sidebar below 900px; phones retain their app-specific navigation. These dimensions are also used in the Home design mockup and verified by `scripts/check-shared-headers.cjs`.

Desktop `.sidebar` navigation stays sticky below the shared header and fills the remaining viewport. Its contents scroll independently when the window is too short to show every item. Inventory achieves the same behavior through its existing app shell and content scroll area.

`header.css` owns the Home and Inventory banner dimensions: 112px high above 800px, 144px on smaller screens, with identical logo widths, padding, facility typography, and Apps button placement. The equipment editor uses the same 112px desktop height, logo width, Apps button, and right inset, with the title and edit QR between the logo and Apps. Wall mode has a dedicated 82px desktop header, with the same branding and navigation pattern. Its header has no theme or display options controls. Smaller screens place the title and QR below the logo and Apps. Read-only wall mode remains available through `?mode=tv`, and existing saved theme preferences are retained. Keep app-specific adapters from resizing shared controls.

Inventory's shell fills the viewport so its banner is not constrained by the old 480px/1440px page limits. Shared banner selectors take precedence over legacy layout selectors. Run `node scripts/check-shared-headers.cjs` to compare rendered banner heights, logo bounds, text positions, and button sizes across Home, Inventory, Inventory served as static files, Alum Hydrometer Conversion, and Plant Flow. The checks cover 320px through 1920px; normal browser scrollbar space is accounted for separately.

Each app keeps its working navigation (such as inventory's Home, History, Order List, and Management). The header's **Apps** button is the shared route between applications. Its drawer is text-only, groups the same application catalog as Operations Home, marks the current app, supports keyboard focus and Escape, and scrolls independently on phones.

The city logo links to Operations Home using the same guarded navigation as the Apps menu. Inventory's local Home tab still opens its inventory start page. Logo links use `.site-header .brand` or `.ops-home-link`; `navigation.js` sets their destination and preserves each host's save/discard checks.

The catalog is exported as `window.Operations.applications` by `navigation.js`. Public suite destinations use `https://water.gibbhub.io`, and inventory uses `https://inventory.gibbhub.io`. Suite pages opened on a local server use that local origin. Do not fetch theme assets across domains: host them with each app.

Before leaving, the menu dispatches a cancelable `operations:before-navigate` event. An app can cancel synchronously, or pass a promise to `event.detail.waitUntil(...)`; a result of `false` prevents navigation. Inventory uses its normal save/validation flow, and the equipment editor confirms before discarding pending changes. Do not silently discard unsaved data or automatically submit forms.

## Packaging and updates

`shared/operations/` is canonical. `node scripts/sync-operations-theme.cjs` copies its files into the standalone inventory's `public/shared/operations/` directory. Both deployment entry points run this synchronization. Edit the canonical files, not their inventory copies. The Inter font and its OFL license ship locally with the theme. Inventory serves the copied assets through its explicit whitelist and includes them in its release fingerprint.

Host adapters (`operations-theme.css`) map app layout and existing variables to the shared tokens. They must preserve workflows, printed dimensions, input behavior, API data formats, and accessibility. For each later migration, check desktop/phone layouts, local asset loading, shared navigation, unsaved-change protection, and the app's main workflow before deploying.

Operations Home uses `apps/dashboard/operations-home.css`. The older `dashboard.css` is retained only for cached legacy HTML; do not replace it with the new layout. The menu's release-qualified Home URL bypasses old cached HTML. A one-time HTTPS migration fetch requests `Clear-Site-Data: "cache"`; cookies and browser storage are not cleared. Home HTML is not stored, and its bundle/shared UI assets revalidate. Update asset URLs when changing a file that was previously served as immutable.

## Study Tools

`study.css` shares the training workspace and mobile chapter navigation. Flashcards retain the original deck and local storage; the Regulation 100 guide uses 15 short lessons with sourced summaries, practice questions, topic search, local review marks, and an all-lessons print layout. `apps/regulation-100-study/lessons.js` holds the editorial content and per-lesson section references. Original scripts and styles remain available for cached legacy pages. Run `node scripts/check-training-pages.cjs` for deck, slide, menu, and responsive layout checks.

## Dose Predictor

The predictor uses the shared header and sidebar with a responsive input/result layout. `operations.js` preserves the existing browser simulation, seasonal values, validation, and saved-input storage key. The UI and copied output identify simulation results without claiming trained-model accuracy. Legacy `script.js` and `styles.css` remain available for cached HTML. Run `node scripts/check-dose-predictor.cjs` to verify calculations, presets, results, storage, copy/reset, navigation, and responsive sizes.

## Hypochlorite Calculator

The filter-basin calculator uses the shared workspace and header. It calculates a one-time batch addition, not a daily feed rate or a final residual. Product strength has an explicit basis (NaOCl weight %, available chlorine weight %, or trade %); specific gravity is editable. Solution weight and available-chlorine-equivalent weight are separate. Editing inputs clears both the result and its worked steps. Run `node scripts/check-hypochlorite-math.cjs` and `node scripts/check-hypochlorite-ui.cjs`. Formula assumptions and published references are recorded in `docs/hypochlorite-calculation.md`.

## RoboJar Analyzer

RoboJar uses the shared header, sidebar, light surfaces, and Inter chart labels. Existing workbook parsing, statistics, regression, forecast methods, and run colors are retained. A sticky Generate Charts action remains available while reviewing long reports. Four chart tabs and compact phone legends accompany horizontally scrollable run/statistics tables. New workbook imports clear stale charts; exports stay disabled while chart settings require regeneration. PNG export uses the active chart's actual canvas ID, and PDF export uses existing generated charts rather than the obsolete single-chart generator. The existing CDN library versions are unchanged. Run `node scripts/check-robojar.cjs` for real XLS import, both sample workbooks, chart/forecast/statistics, legends, help keyboard behavior, PNG/PDF output, and responsive checks. Set `OPS_PUBLIC=1` to check the deployed app.

## Water Data Explorer

The four analysis views use the shared sidebar and header, Inter chart labels, light surfaces, and responsive chart controls. The app continues to load `Streaming_Current_Data.xlsx`; the dataset card explicitly identifies historical workbook data and provides reload/progress/error handling. Original analysis code is retained with only its chart-font declaration changed in `operations.js`. The adapter adds accessible tab/help state, modal focus/Escape handling, reset zoom, and common notifications. Existing AI provider integration is preserved. `scripts/check-water-explorer.cjs` checks all views, variables, smoothing, chart zoom, histograms, correlations, real PDF output, reload, shared geometry, and phone sizes. AI requests are mocked during checks, so tests do not send workbook data to an AI provider. Set `OPS_PUBLIC=1` to check the deployed app.

## Equipment Wall Readability

`wall-readability.css` adds the wall-specific geometry and solid contrast colors; `wall-comments.js` reports the static comment count and overflow status. Pin choices persist through the shared comments API. See [wall display behavior and validation](equipment-wall-display.md). The editor and phone views retain the full comment list. Run `npm run check:ui -- equipment headers` after changing either presentation or connection behavior.

# Legacy Asset Retention

Reviewed October 23, 2026. These files were checked during cleanup and retained deliberately. A file that is absent from the current HTML can still serve an older cached HTML document.

## Current Dependencies

| App | Files That Are Still Active |
| --- | --- |
| Alum Hydrometer | `styles.css`, `script.js`, and the Operations adapter |
| Equipment Status Board | `styles.css`, `script.js`, `wall-ui.*`, the Operations adapter, and desktop layout |
| Inventory | `public/styles.css`, `public/app.js`, and its supporting scripts; shared theme files are copied for the standalone container |
| MWAT Calculator | Original `styles.css` and `script.js`; the mockup also loads the original calculation script |
| NH4 Loading | Original `styles.css` and `script.js`; the mockup imports that stylesheet and runs the original script |
| Shared | `global-styles.css` is still loaded by Equipment Status Board, MWAT, and NH4 Loading |

## Cached Page Compatibility

| App | Retained Legacy Assets | Reason |
| --- | --- | --- |
| Operations Home | `dashboard.css` | The Home regression check explicitly verifies that cached old HTML remains readable before the release-qualified new Home loads. Docker also copies it to the root compatibility URL. |
| Plant Flow | `assets/index-jDXMqWz2.js`, `assets/index-Blg8mCHw.css` | The prior compiled page loads these fingerprinted bundles. |
| Dose Predictor | `script.js`, `styles.css` | Old HTML compatibility; the calculation regression also compares the original presets and simulation. |
| Sodium Hypochlorite | `script.js`, `styles.css` | Old HTML compatibility. Current calculations use `calculation.js`; retiring the old UI must not replace this audited math. |
| RoboJar | `script.js`, `styles.css` | Old HTML compatibility. |
| Water Data Explorer | `script.js`, `styles.css` | Old HTML compatibility. The old stylesheet references the three retained Source Sans Pro fonts. |
| Video Tutorials | `script.js`, `styles.css` | Old HTML compatibility; checks also compare the original lesson catalog. |
| Flashcards | `script.js`, `styles.css` | Old HTML compatibility; checks also compare the original deck. |
| Regulation 100 | `script.js`, `styles.css` | Old HTML compatibility. |

The old deployment configuration allowed a one-year HTTP cache lifetime (`31536000` seconds) for static assets. With the Operations migration still recent, this cleanup cannot establish that all older HTML has expired. Use **October 23, 2027 as the earliest review date**, not an automatic deletion date. Confirm the last legacy HTML deployment and its cache lifetime before retiring these files. Updating the compatibility cutoff is required if legacy HTML is served again.

When retirement is safe, update tests that use original scripts as regression baselines before deleting those scripts. Preserve lesson/deck/calculation reference data in fixtures instead of dropping those assertions. Verify old URLs, current workflows, mockups, PDF exports, and font requests before deployment.

## Removed Font Experiments

Nineteen font binaries with no current path references were removed from `assets/fonts/`: the unused Atkinson, Dashboard, Helvetica Neue, and Inter files, and unused Source Sans Pro weights/styles. This saved 3,595,516 bytes (about 3.43 MiB). The canonical shared Inter font, its standalone inventory copy, and the three Source Sans Pro fonts referenced by the legacy explorer stylesheet remain, with their licenses.

WOFF2 conversion is optional future performance work, not required for this cleanup. The current theme still serves its tested TTF file. A conversion should ship its own font-loading and typography verification rather than adding a new font-processing dependency to the runtime app.

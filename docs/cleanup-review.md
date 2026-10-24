# Workspace Cleanup Review

Reviewed October 23, 2026. This pass changes development artifacts and checks; it does not deploy or change app behavior.

## Completed

- Removed retired mockup directories for Operations Home, Inventory (including bin-card and icon experiments), Plant Flow, and Equipment Status Board.
- Kept the complete MWAT Calculator and NH4 Loading design directories, including their working previews, screenshots, and comparison checks.
- Removed generated root preview screenshots, two dummy text files, and the two generated deployment archives. The deployment scripts recreate the archives when needed. Existing ignore rules already cover these generated directories.
- Removed 88 files totaling approximately 24 MiB before verification regenerated its temporary screenshots.
- Preserved the equipment-board sample dataset as `scripts/fixtures/live-ops-state.json`; its integration test now loads this fixture instead of depending on a mockup.
- Removed retired mockup routes from the shared-header check and unused design-directory variables from browser checks. Updated the design-system documentation to describe the current checks.

Inventory's separate `preview/` directory also contains supplier captures, image research, and purchase/pack-size audit artifacts. These were retained rather than treating them as disposable UI mockups. App data, sample workbooks, product images, dependencies, and environment files were retained.

## Follow-Up Cleanup Completed

### Font Assets

Removed 19 unreferenced font binaries from the old assets directory, including the duplicate Inter font, unused Inter italic, the Atkinson/Dashboard/Helvetica experiments, and unused Source Sans Pro weights/styles. This saved another 3,595,516 bytes (3.43 MiB). The canonical shared Inter font, its standalone inventory copy, the three Source Sans Pro fonts referenced by the old explorer stylesheet, and their licenses remain.

No runtime font-processing dependency was added. Compressed WOFF2 conversion is optional future performance work; the current tested TTF paths and typography remain unchanged.

### Browser Check Infrastructure

All ten suite browser checks and both retained mockup checks now share browser infrastructure in `scripts/lib/browser-check.cjs`. The helper handles Chrome startup (with a `CHROME_PATH` override), DevTools calls, JavaScript error collection, static serving where needed, and teardown. Servers and Chrome are closed and test profiles removed on completion or failure. The equipment check retains its custom proxy and temporary API data while sharing the browser helper.

The regression assertions remain in the individual checks. A serial runner is available as `npm run check:ui`; use `npm run check:ui -- home headers` for a subset. The runner forces local mode and excludes the separate public-site check, so it cannot accidentally run against production because of a shell's `OPS_PUBLIC` setting.

### Legacy Assets

Reviewed the current entry points, CSS imports, font paths, compiled Plant Flow bundles, and regression-baseline dependencies. Files still serving current or cached HTML were retained with an explicit rationale in [legacy asset retention](legacy-assets.md). The previous one-year cache policy makes October 23, 2027 the earliest review date for cached-page compatibility removal, subject to confirming the last legacy HTML deployment.

This completes the dependency review; retaining these files is intentional compatibility support. Removing them now could break returning operators' cached pages. The cleanup makes no changes to production routes, cache policy, calculations, lesson catalogs, or saved data.

### Generated Artifacts

The tracked inventory deployment archive is deleted from the working tree. Existing ignore rules prevent regenerated deployment archives and screenshots from being added accidentally. Deployment scripts will recreate release packages when requested. No Git history rewrite, commit, or deployment was performed.

Updated the main README with the correct Operations Home path and the shared check commands. Removed screenshots generated during this verification from the root preview directory. The two retained mockups keep their own preview images.

## Verification

All 12 local check groups passed:

- Independent hypochlorite math, cached-HTML Home migration, shared headers/sidebar geometry, and equipment API/edit/comment/SSE workflows against temporary data.
- Dose Predictor, Hypochlorite UI, RoboJar workbook/charts/exports, Videos, Flashcards/Regulation 100, and Water Data Explorer.
- Both retained MWAT and NH4 mockups match their original calculation scripts, tables, and chart data across upload/filter scenarios.

The shared-header and equipment checks ran individually; the other ten groups ran through the serial runner. All changed JavaScript files passed syntax checks. Shared Inter and inventory's standalone font were unchanged. Only MWAT Calculator and NH4 Loading retain app design directories.

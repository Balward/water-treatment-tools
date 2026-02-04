# Water Treatment Tools

A collection of focused, single-page web apps that help operators analyze data, size chemical feeds, and train staff for surface water and wastewater treatment. Everything is static HTML/CSS/JS (no build step required); just open an app’s `index.html` in a browser or serve the `/apps` folder from any web server.

## App directory

- `apps/dashboard/` – Launch pad with city branding and links to every tool.
- `apps/plant-flow/` – Interactive detention-time model; toggle basins, adjust flow, and see chemical travel times and cumulative detention. Mobile-friendly with in-app help.
- `apps/robojar-analyzer/` – Analyze RoboJar particle reports; charts, stats, forecasting, export to PNG/PDF.
- `apps/dose-predictor/` – Permanganate dose predictor using historical patterns.
- `apps/alum-hydrometer-conversion/` – Convert alum hydrometer readings to percent strength.
- `apps/sodium-hypochlorite-calculator/` – Sodium hypochlorite dose calculator for filters/basins.
- `apps/mwat-calculator/` – Maximum Weekly Average Temperature calculator from overlapping CSVs.
- `apps/nh4-loading/` – Ammonia (NH₄) loading insights for wastewater.
- `apps/regulation-100-study/` – Operator certification study guide.
- `apps/video-tutorials/` – Class A training video library.
- `apps/water-treatment-flashcards/` – Flashcards for key terms and concepts.
- `apps/water-data-explorer/` – Correlation, time series, and distribution explorer for water quality data.

## Quick use

1. Open `apps/dashboard/index.html` in a browser to navigate the suite, or open any app’s `index.html` directly.
2. Use `sample-data/` for quick demos where provided (e.g., RoboJar Analyzer).
3. Most apps are client-side only; no backend is required.

## Optional proxy (for AI/remote calls)

A small Express proxy can be run if needed by certain integrations:

```
npm install
npm start   # runs claude-proxy-server.js
```

Environment: copy `.env.template` to `.env` and set required keys. The proxy is not needed for normal static use.

## Design system

- Shared styles: `global-styles.css` plus app-specific `styles.css`.
- Icons/logos: `assets/logos/`.
- Each app ships pre-bundled assets in its `assets/` subfolder; no build step is required unless you edit source JS/TS (if present, the bundled file names are already referenced in the HTML).

## File layout

```
apps/                 individual tools (see above)
assets/               shared images/logos
docs/                 supplementary docs and guides
sample-data/          demo datasets (where applicable)
global-styles.css     shared typography and theme
nginx.conf            sample reverse-proxy/static hosting config
claude-proxy-server.js optional Express proxy
package.json          proxy dependencies/scripts
```

## Contributing and customization

- Modify an app’s `styles.css` and `index.html` for content or layout tweaks.
- When updating bundled JS assets, regenerate the build artifact the HTML references (e.g., `assets/index-*.js` / `.css`) using the app’s preferred bundler if source is available.
- Keep mobile responsiveness in mind; most layouts rely on CSS grid/flex with clamp-based spacing.

## Support

If you discover an issue or need a new calculation/workflow, open an issue in the repository or update the relevant app folder with a short note in `docs/`.

// Run checks serially: local browser checks intentionally share fixed localhost ports.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const checks = {
  sops: 'scripts/check-sop-creator.cjs',
  'rounds-api': 'scripts/check-plant-rounds-api.cjs',
  'rounds-pdf': 'scripts/check-plant-rounds-pdf.cjs',
  rounds: 'scripts/check-plant-rounds.cjs',
  math: 'scripts/check-hypochlorite-math.cjs',
  home: 'scripts/check-operations-home.cjs',
  headers: 'scripts/check-shared-headers.cjs',
  equipment: 'scripts/check-live-ops.cjs',
  dose: 'scripts/check-dose-predictor.cjs',
  hypochlorite: 'scripts/check-hypochlorite-ui.cjs',
  robojar: 'scripts/check-robojar.cjs',
  videos: 'scripts/check-video-tutorials.cjs',
  training: 'scripts/check-training-pages.cjs',
  explorer: 'scripts/check-water-explorer.cjs',
  mwat: 'apps/mwat-calculator/design/check-mockup.cjs',
  nh4: 'apps/nh4-loading/design/check-mockup.cjs',
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(checks);
if (names.some(name => !checks[name])) {
  console.error('Choose checks from: ' + Object.keys(checks).join(', '));
  process.exit(1);
}
// Always exercise local apps and temporary API data, regardless of the calling shell.
const env = { ...process.env };
delete env.OPS_PUBLIC;
for (const name of names) {
  console.log('\nRunning ' + name + ' check');
  const result = spawnSync(process.execPath, [checks[name]], {
    cwd: path.resolve(__dirname, '..'), env, windowsHide: true, stdio: 'inherit', timeout: 180000,
  });
  if (result.error || result.status !== 0) {
    console.error(result.error || 'Check failed: ' + name);
    process.exit(result.status || 1);
  }
}
console.log('\nAll selected Operations checks passed.');

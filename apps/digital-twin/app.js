'use strict';

const processIcons = {
  inlet: `
    <path class="vessel-land" d="M5 29 17 14l8 6 10-13 11 10 7-6 18 18Z"/>
    <path class="vessel-water" d="M6 30c9-6 17-5 25-2 8 3 16 3 22-1 6-3 12-1 17 3l-6 14-14 5H25L13 44Z"/>
    <path class="vessel-ripple" d="M14 35c5-2 8-2 13 0m7 0c5 2 9 2 14 0m7 1c4-2 7-2 10-1M23 42c5-2 9-2 14 0m6 0c5 1 9 0 13-1"/>`,
  mix: `
    <path class="vessel-water vessel-fill" d="M12 28h52v16c0 4-3 7-7 7H19c-4 0-7-3-7-7Z"/>
    <path d="M12 20v24c0 4 3 7 7 7h38c4 0 7-3 7-7V20M12 28h18m16 0h18M23 17h30"/>
    <rect class="vessel-solid" x="33" y="6" width="10" height="11" rx="2"/>
    <path d="M38 17v22"/>
    <path class="vessel-solid" d="m38 37-12-3v5l12 3 12-3v-5Z"/>
    <path class="vessel-ripple" d="M18 38c0-3 2-5 5-6m34 7c0 3-2 5-5 6"/>`,
  floc: `
    <path class="vessel-water vessel-fill" d="M8 26h60v20c0 3-2 5-5 5H13c-3 0-5-2-5-5Z"/>
    <path d="M8 19v27c0 3 2 5 5 5h50c3 0 5-2 5-5V19M8 26h11m38 0h11M9 32h58"/>
    <path class="vessel-paddle" d="m25 20 26 24m0-24L25 44"/>
    <path class="vessel-paddle-tip" d="m22 23 6-6m20 0 6 6M22 41l6 6m20 0 6-6"/>
    <circle class="vessel-solid" cx="38" cy="32" r="3.5"/>`,
  settle: `
    <path class="vessel-water" d="M7 23v10c0 4 8 8 14 10l13 9h8l13-9c6-2 14-6 14-10V23Z"/>
    <ellipse class="vessel-surface" cx="38" cy="23" rx="31" ry="9"/>
    <path d="M13 29c5 4 15 7 25 7s20-3 25-7M25 43l13 8 13-8M38 9v9"/>
    <path class="vessel-surface" d="M33 18h10v6c0 3-10 3-10 0Z"/>
    <path d="M29 23H17m4-3-4 3 4 3m26-3h12m-4-3 4 3-4 3"/>`,
  contact: `
    <path class="vessel-water vessel-fill" d="M11 26h54v17c0 4-3 7-7 7H18c-4 0-7-3-7-7Z"/>
    <path d="M11 16v27c0 4 3 7 7 7h40c4 0 7-3 7-7V16M11 26h54"/>
    <path class="vessel-ripple" d="M20 34c4-2 8-2 12 0m6 0c4 2 8 2 12 0m-25 8c4-2 8-2 12 0m6 0c4 2 8 2 12 0"/>`,
  filter: `
    <path class="vessel-water vessel-fill" d="M12 16h52v34H12Z"/>
    <path class="vessel-media-upper" d="M12 26h52v8H12Z"/>
    <path class="vessel-media-middle" d="M12 34h52v8H12Z"/>
    <path class="vessel-media-lower" d="M12 42h52v8H12Z"/>
    <path d="M12 11v39h52V11M12 16h52M12 26h52m-52 8h52m-52 8h52"/>
    <path class="vessel-grains" d="M19 30h2m9 0h3m8 0h2m9 0h3M17 38h4m10 0h2m10 0h3m8 0h4m-38 8h3m9 0h4m9 0h4m8 0h2"/>`,
  storage: `
    <rect class="vessel-water" x="7" y="12" width="62" height="36" rx="3"/>
    <path class="vessel-baffle" d="M22 12v27m16-18v27m16-36v27"/>
    <path class="vessel-ripple" d="M2 21h12v22h16V17h16v26h16V23h12m-4-4 4 4-4 4"/>
    <path d="m27 31 3-4 3 4m10-3 3 4 3-4"/>`
};

const stages = [
  {
    name: 'Raw water', icon: 'inlet', note: 'Influent conditions',
    detail: 'Source-water measurements describe the water entering treatment.',
    points: [
      ['Raw turbidity and pH', 'Raw water sample · Chemical Building on Plant Rounds'],
      ['Influent flow, alkalinity, TOC and temperature', 'Raw water · verify meters and sampling methods']
    ]
  },
  {
    name: 'Rapid mix', icon: 'mix', note: 'Alum + polymer',
    detail: 'Plant Flow maps alum and polymer feeds at rapid mix. Confirm the exact taps and injection order.',
    points: [
      ['Streaming current', 'Sample drawn from rapid mix · sample-line delay to confirm'],
      ['Rapid-mix pH', 'Floc Vault on Plant Rounds'],
      ['Zeta potential', 'In historian export · sampling point to confirm']
    ]
  },
  {
    name: 'Flocculation', icon: 'floc', note: 'East + west',
    detail: 'Two parallel floc basins precede the east and west clarifiers.',
    points: [['Floc observations', 'Confirm sampling locations and whether any continuous readings are available']]
  },
  {
    name: 'Clarifiers', icon: 'settle', note: 'East + west',
    detail: 'Settled-water turbidity provides an upstream measure of coagulation and clarification performance.',
    points: [
      ['East and west clarifier turbidity', 'Pipe Gallery on Plant Rounds · verify the separate tags'],
      ['Settled water turbidity', 'Historian sample point · confirm whether it represents a combined stream']
    ]
  },
  {
    name: 'PAC chamber', icon: 'contact', note: 'Before filtration',
    detail: 'Plant Flow places the PAC chamber between clarification and filtration and maps hypochlorite feed here.',
    points: [['Sample inventory', 'Confirm analyzer taps, if present']]
  },
  {
    name: 'Filters', icon: 'filter', note: '8 filter units',
    detail: 'Combined filter effluent gives a plant-wide reading. Individual filter trends help isolate run and backwash effects.',
    points: [
      ['Combined filter effluent turbidity', 'Historian · verify the physical combined sample tap'],
      ['Individual filter turbidity and headloss', 'Request tags by filter and confirm backwash state']
    ]
  },
  {
    name: 'Clearwells', icon: 'storage', note: 'A + B',
    detail: 'Finished-water quality checks follow filtration. Clearwell chemistry is outside the demo response model.',
    points: [
      ['Finished-water pH, TOC and alkalinity', 'Mapped to clearwells · confirm sampling method'],
      ['Clearwell pH', 'Clearwell A and basement (Clearwell B) on Plant Rounds']
    ]
  }
];

const $ = id => document.getElementById(id);
const state = { ...Twin.defaults };
let baseline = { ...Twin.defaults };
let selected = 1;
const metricFormats = {
  settled: [2, 'NTU'], filtered: [3, 'NTU'], mass: [0, 'lb/day'], time: [0, 'min']
};
const number = (value, digits) => value.toLocaleString('en-US', {
  minimumFractionDigits: digits, maximumFractionDigits: digits
});
const duration = value => {
  const minutes = Math.round(value);
  return minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm';
};

$('controls').innerHTML = Twin.inputs.map(({ key, label, unit, min, max, step }) => `
  <div class="control">
    <div class="control-top"><label for="${key}">${label}</label><span><output id="${key}-value" for="${key}"></output> ${unit}</span></div>
    <input type="range" id="${key}" min="${min}" max="${max}" step="${step}">
  </div>`).join('');

$('train').innerHTML = stages.map(({ name, icon, note }, i) => `
  <li><button type="button" class="stage" data-stage="${i}" aria-pressed="false">
    <svg class="vessel" viewBox="0 0 76 56" aria-hidden="true" focusable="false">${processIcons[icon]}</svg>
    <strong>${name}</strong><small>${note}</small><span class="stage-value" id="stage-${i}"></span>
  </button></li>`).join('');

function selectStage(index) {
  selected = index;
  $('train').querySelectorAll('button').forEach((button, i) => {
    button.setAttribute('aria-pressed', i === selected);
  });
  const { name, detail, points } = stages[index];
  $('stage-name').textContent = name;
  $('stage-description').textContent = detail;
  $('instruments').innerHTML = points.map(([label, location]) =>
    '<li><strong>' + label + '</strong><span>' + location + '</span></li>').join('');
}

function render() {
  const current = Twin.simulate(state);
  const reference = Twin.simulate(baseline);
  for (const [key, [digits, unit]] of Object.entries(metricFormats)) {
    const difference = current[key] - reference[key];
    $(key).textContent = key === 'time' ? duration(current[key]) : number(current[key], digits);
    const magnitude = number(Math.abs(difference), digits);
    $(key + '-delta').textContent = Number(magnitude.replaceAll(',', '')) === 0
      ? 'Matches baseline'
      : (difference > 0 ? '+' : '−') + magnitude + ' ' + unit + ' vs baseline';
  }
  const readings = [
    number(state.raw, 1) + ' NTU',
    number(state.alum, 1) + ' / ' + number(state.polymer, 2) + ' mg/L',
    '',
    number(current.settled, 2) + ' NTU',
    '',
    number(current.filtered, 3) + ' NTU',
    ''
  ];
  readings.forEach((reading, i) => { $('stage-' + i).textContent = reading; });
  for (const { key, step } of Twin.inputs) {
    $(key).value = state[key];
    $(key + '-value').textContent = number(state[key], String(step).split('.')[1]?.length || 0);
  }
}

$('controls').addEventListener('input', event => {
  state[event.target.id] = event.target.valueAsNumber;
  render();
});
$('train').addEventListener('click', event => {
  const button = event.target.closest('[data-stage]');
  if (button) selectStage(Number(button.dataset.stage));
});
$('reset').addEventListener('click', () => {
  Object.assign(state, Twin.defaults);
  baseline = { ...Twin.defaults };
  $('baseline-label').textContent = 'Comparing with the demo baseline';
  render();
});
$('pin').addEventListener('click', () => {
  baseline = { ...state };
  $('baseline-label').textContent = 'Comparing with your saved inputs';
  render();
});

$('download').href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(Twin.csvTemplate);
$('import-form').addEventListener('submit', event => event.preventDefault());
$('csv').addEventListener('change', async event => {
  const input = event.currentTarget;
  const [file] = input.files;
  const result = $('import-result');
  if (!file) {
    result.textContent = 'Checks run in this browser.';
    return;
  }
  result.textContent = 'Checking CSV…';
  try {
    const content = await file.text();
    if (input.files[0] !== file) return;
    const { total, valid, invalid, duplicates, gaps, first, last } = Twin.checkCsv(content);
    const missing = [...gaps].filter(([, count]) => count > 0)
      .map(([name, count]) => name + ' (' + count + ')').join(', ');
    result.textContent = [
      `${number(valid, 0)} of ${number(total, 0)} rows have valid, unique timestamps and valid numeric entries.`,
      `${number(duplicates, 0)} duplicates · ${number(invalid, 0)} invalid rows.`,
      valid ? new Date(first).toISOString() + ' to ' + new Date(last).toISOString() + '.' : '',
      missing ? 'Blank readings: ' + missing + '.' : ''
    ].filter(Boolean).join(' ');
  } catch (error) {
    if (input.files[0] === file) result.textContent = error.message;
  }
});

const menuButton = document.querySelector('[data-ops-menu]');
if (window.Operations) menuButton.hidden = false;

const sectionLinks = [...document.querySelectorAll('.sidebar .nav-item')];
function updateSectionLink() {
  const current = sectionLinks.find(link => link.hash === location.hash) ?? sectionLinks[0];
  for (const link of sectionLinks) {
    if (link === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange', updateSectionLink);
updateSectionLink();
selectStage(selected);
render();

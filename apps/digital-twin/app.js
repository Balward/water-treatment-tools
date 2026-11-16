'use strict';

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
    <span class="vessel ${icon}" aria-hidden="true"><i></i><i></i><i></i></span>
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

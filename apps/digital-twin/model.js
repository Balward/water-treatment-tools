'use strict';

const Twin = (() => {
  const inputs = [
    { key: 'flow', label: 'Influent flow', unit: 'MGD', min: 1, max: 14, step: 0.1, value: 8 },
    { key: 'raw', label: 'Raw water turbidity', unit: 'NTU', min: 0.5, max: 50, step: 0.1, value: 4 },
    { key: 'ph', label: 'Raw water pH', unit: 'SU', min: 6.5, max: 9, step: 0.01, value: 7.2 },
    { key: 'alum', label: 'Alum dose', unit: 'mg/L', min: 5, max: 45, step: 0.5, value: 19 },
    { key: 'polymer', label: 'Cationic polymer dose', unit: 'mg/L', min: 0, max: 5, step: 0.05, value: 2.75 }
  ];
  const defaults = Object.fromEntries(inputs.map(({ key, value }) => [key, value]));

  // Total in-service volumes (MG) from the existing Plant Flow tool.
  const stageVolumes = [0.00574, 2 * 0.116, 2 * 1.326, 0.047235, 8 * 0.0354];

  function simulate({ flow, raw, ph, alum, polymer }) {
    // Placeholder response surfaces for demonstrating the UI only.
    const alumEffect = (alum - (18 + 2.7 * Math.log(raw / 4))) / 11;
    const polymerEffect = (polymer - 2.4 - 0.18 * alumEffect) / 1.6;
    const phEffect = (ph - 7.3) / 1.1;
    const load = (flow / 8) ** 0.7;
    const settled = 0.18 + Math.sqrt(raw) * (0.054 + 0.084 * alumEffect ** 2 +
      0.036 * polymerEffect ** 2 + 0.030 * phEffect ** 2) * load;
    const filtered = 0.012 + settled * (0.041 + 0.009 * Math.max(0, load - 1));
    return {
      settled,
      filtered,
      mass: flow * (alum + polymer) * 8.3454,
      time: stageVolumes.reduce((sum, volume) => sum + volume, 0) / flow * 1440
    };
  }

  const columns = [
    ['timestamp', 'timestamp'], ['flow_mgd', 'number', 0], ['raw_turbidity_ntu', 'number', 0],
    ['raw_ph_su', 'number', 0, 14], ['alum_mg_l', 'number', 0], ['polymer_mg_l', 'number', 0],
    ['streaming_current_mv', 'number', -Infinity], ['settled_turbidity_ntu', 'number', 0],
    ['combined_filter_turbidity_ntu', 'number', 0]
  ];
  const csvTemplate = columns.map(([name]) => name).join(',') + '\r\n';

  function csvRows(content) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    let afterQuote = false;
    const addCell = () => {
      row.push(cell.trim());
      cell = '';
      afterQuote = false;
    };
    for (let i = 0; i < content.length; i += 1) {
      const char = content[i];
      if (quoted) {
        if (char !== '"') cell += char;
        else if (content[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else if (char === ',' || char === '\n' || char === '\r') {
        addCell();
        if (char !== ',') {
          if (row.some(Boolean)) rows.push(row);
          row = [];
          if (char === '\r' && content[i + 1] === '\n') i += 1;
        }
      } else if (char === '"' && !cell && !afterQuote) quoted = true;
      else if (char === '"' || afterQuote) throw new Error('Check the CSV quoting.');
      else cell += char;
    }
    if (quoted) throw new Error('The CSV has an unclosed quoted field.');
    addCell();
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function parseTimestamp(value) {
    const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:[0-5]\d)$/.exec(value);
    if (!match) return NaN;
    const day = new Date(match[1]);
    if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== match[1]) return NaN;
    return Date.parse(value);
  }

  function checkCsv(content) {
    const [header, ...records] = csvRows(content.replace(/^\uFEFF/, ''));
    if (!header) throw new Error('The CSV is empty.');
    const positions = new Map(header.map((name, index) => [name, index]));
    if (positions.size !== header.length) throw new Error('Column names must be unique.');
    const missing = columns.filter(([name]) => !positions.has(name)).map(([name]) => name);
    if (missing.length) throw new Error('Missing columns: ' + missing.join(', ') + '.');
    if (!records.length) throw new Error('The CSV has a header but no measurements.');
    const timestamps = new Set();
    const gaps = new Map(columns.map(([name]) => [name, 0]));
    let invalid = 0;
    let duplicates = 0;
    for (const row of records) {
      const timestamp = parseTimestamp(row[positions.get('timestamp')]);
      if (row.length !== header.length || !Number.isFinite(timestamp)) {
        invalid += 1;
        continue;
      }
      const blanks = [];
      let badValue = false;
      for (const [name, type, min, max = Infinity] of columns) {
        if (type === 'timestamp') continue;
        const value = row[positions.get(name)];
        if (value === '') blanks.push(name);
        else {
          const number = Number(value);
          if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
              !Number.isFinite(number) || number < min || number > max) badValue = true;
        }
      }
      if (badValue) invalid += 1;
      else if (timestamps.has(timestamp)) duplicates += 1;
      else {
        timestamps.add(timestamp);
        blanks.forEach(name => gaps.set(name, gaps.get(name) + 1));
      }
    }
    let first = Infinity;
    let last = -Infinity;
    for (const stamp of timestamps) {
      first = Math.min(first, stamp);
      last = Math.max(last, stamp);
    }
    return { total: records.length, valid: timestamps.size, invalid, duplicates, gaps, first, last };
  }

  return { inputs, defaults, simulate, csvTemplate, checkCsv };
})();

if (typeof module !== 'undefined') module.exports = Twin;

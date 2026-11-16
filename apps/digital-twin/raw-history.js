'use strict';

(() => {
  const form = document.getElementById('raw-history-form');
  const input = form.elements.namedItem('raw-history-file');
  const status = document.getElementById('raw-history-status');
  const exportsList = document.getElementById('raw-history-exports');
  const empty = document.getElementById('raw-history-empty');

  function localTimestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
    // Use UTC only to validate the calendar components, without assigning a zone to the sample.
    const calendar = new Date(value + ':00Z');
    return Number.isFinite(+calendar) && calendar.toISOString().slice(0, 16) === value;
  }

  function readExport(text) {
    const data = JSON.parse(text);
    if (data?.schema !== 'digital-twin/raw-water/v1' ||
        typeof data.source !== 'string' || !data.source.trim() ||
        typeof data.sheet !== 'string' || !data.sheet.trim() ||
        (data.timeZone !== null && typeof data.timeZone !== 'string') ||
        !Array.isArray(data.records) || !data.records.length) {
      throw new Error('Choose a prepared Digital Twin raw-water JSON export.');
    }
    if (data.timeZone !== null) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: data.timeZone }); }
      catch { throw new Error('The export time zone is invalid.'); }
    }
    let first = '';
    let last = '';
    let alkalinityCount = 0;
    let temperatureCount = 0;
    for (const [i, row] of data.records.entries()) {
      if (!Array.isArray(row) || row.length !== 3) {
        throw new Error('Invalid raw-water record at row ' + (i + 1) + '.');
      }
      const [timestamp, alkalinity, temperature] = row;
      if (!localTimestamp(timestamp) || (last && timestamp <= last) ||
          (alkalinity !== null && (!Number.isFinite(alkalinity) || alkalinity < 0)) ||
          (temperature !== null && !Number.isFinite(temperature))) {
        throw new Error('Invalid or out-of-order raw-water record at row ' + (i + 1) + '.');
      }
      if (!first) first = timestamp;
      last = timestamp;
      if (alkalinity !== null) alkalinityCount += 1;
      if (temperature !== null) temperatureCount += 1;
    }
    if (!(alkalinityCount || temperatureCount)) throw new Error('The export contains no measurements.');
    const id = JSON.stringify([data.source, data.sheet]);
    const summary = {
      id, source: data.source, sheet: data.sheet, timeZone: data.timeZone, first, last,
      rowCount: data.records.length, alkalinityCount, temperatureCount
    };
    return { summary, records: data.records };
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('digital-twin-history', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('exports', { keyPath: 'id' });
        request.result.createObjectStore('samples', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other Digital Twin tabs and retry.'));
    });
  }

  async function saveExport(database, { summary, records }) {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['exports', 'samples'], 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error || new Error('The browser could not save the import.'));
      transaction.objectStore('exports').put(summary);
      transaction.objectStore('samples').put({ id: summary.id, records });
    });
  }

  async function displayExports(database) {
    const summaries = await new Promise((resolve, reject) => {
      const request = database.transaction('exports').objectStore('exports').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = summaries.sort((left, right) => right.first.localeCompare(left.first)).map(summary => {
      const row = document.createElement('tr');
      const source = document.createElement('th');
      source.scope = 'row';
      source.textContent = summary.source + ' · ' + summary.sheet;
      row.append(source);
      const dates = summary.first.replace('T', ' ') + ' to ' + summary.last.replace('T', ' ');
      for (const value of [
        dates + ' · ' + (summary.timeZone || 'time zone unspecified'),
        summary.rowCount, summary.alkalinityCount, summary.temperatureCount
      ]) {
        const cell = document.createElement('td');
        cell.textContent = typeof value === 'number' ? value.toLocaleString('en-US') : value;
        row.append(cell);
      }
      return row;
    });
    exportsList.replaceChildren(...rows);
    empty.hidden = rows.length > 0;
    exportsList.closest('table').hidden = !rows.length;
  }

  input.disabled = true;
  const database = openDatabase();
  database.then(async db => {
    await displayExports(db);
    input.disabled = false;
  }).catch(() => { status.textContent = 'Raw-water history storage is unavailable in this browser.'; });

  form.addEventListener('submit', event => event.preventDefault());
  input.addEventListener('change', async () => {
    const [file] = input.files;
    if (!file) return;
    input.disabled = true;
    status.textContent = 'Validating raw-water history…';
    try {
      const exported = readExport(await file.text());
      const db = await database;
      await saveExport(db, exported);
      await displayExports(db);
      status.textContent = 'Raw-water history saved in this browser.';
    } catch (error) {
      status.textContent = 'Import failed. ' + error.message;
    } finally {
      input.value = '';
      input.disabled = false;
    }
  });
})();

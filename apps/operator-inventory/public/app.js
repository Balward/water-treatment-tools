'use strict';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const SHOW_PRODUCT_IMAGES = true;
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const light = theme === 'light';
  $('theme-label').textContent = light ? 'Dark mode' : 'Light mode';
  $('theme-toggle').setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
  document.querySelector('meta[name="theme-color"]').content = light ? '#f3f5f7' : '#151b20';
  try { localStorage.setItem('inventory-theme',theme); } catch { /* Storage may be unavailable. */ }
}
let initialTheme = 'dark';
try { if (localStorage.getItem('inventory-theme') === 'light') initialTheme = 'light'; } catch { /* Use the default. */ }
setTheme(initialTheme);
$('theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
let catalog, run = null, selectedWorksheet = '', locationName = '', mode = 'home', records = [];
let pending = {}, inFlight = {}, timer, saving = false, conflict = false, completing = false, navigating = false;
const invalid = new Set(), invalidValues = {};
let deleteTarget = null, deleting = false;
let historyRequest = 0;
let emailConfig = { enabled:false, defaultTo:'' }, reportInventory = null, sendingReport = false;
const approvedCounts = new Map();
let reviewingCount = false, finishCountReview;
function unusualCount(previous, value) {
  if (typeof previous !== 'number' || typeof value !== 'number' || !Number.isFinite(previous) || !Number.isFinite(value) || previous < 0 || value < 0) return false;
  if (Math.abs(value - previous) < 2) return false;
  return previous === 0 ? value >= 10 : value >= previous * 3 || value <= previous / 4;
}
function askAboutCount(item, value) {
  const unit = InventoryPackSizes.countSize(item) || 'units';
  $('unusual-copy').textContent = InventoryPackSizes.normalize(item).description;
  $('unusual-previous').textContent = run.previousCounts[item.id];
  $('unusual-entered').textContent = value;
  document.querySelectorAll('.unusual-unit').forEach(label => { label.textContent = unit; });
  return new Promise(resolve => {
    finishCountReview = resolve;
    document.activeElement?.blur();
    $('unusual-dialog').showModal();
    $('unusual-title').focus({preventScroll:true});
  });
}
function closeCountReview(confirmed) {
  const resolve = finishCountReview; finishCountReview = null;
  $('unusual-dialog').close(); resolve?.(confirmed);
}
$('confirm-unusual').addEventListener('click', () => closeCountReview(true));
$('edit-unusual').addEventListener('click', () => closeCountReview(false));
$('unusual-dialog').addEventListener('cancel', event => { event.preventDefault(); closeCountReview(false); });

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: response.status });
  return data;
}
function notify(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
function worksheetName(id) { return catalog?.worksheets.find(w => w.id === id)?.name || 'Inventory'; }
function countOf(id) {
  if (Object.hasOwn(pending, id)) return pending[id];
  if (Object.hasOwn(inFlight, id)) return inFlight[id];
  return run?.counts[id];
}
function counted(items) { return items.filter(i => typeof countOf(i.id) === 'number').length; }
function locations() { return [...new Set(run.items.map(i => i.location))]; }
function status(item) {
  if (invalid.has(item.id)) return ['', 'Invalid count'];
  const count = countOf(item.id);
  if (typeof count !== 'number') return ['', 'Not counted'];
  if (item.par === null) return ['manual', 'As needed'];
  return count <= item.par ? ['low', 'At / below PAR'] : ['ok', 'Above PAR'];
}
function prettyDate(date) { return new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }); }
function resetEdits() { approvedCounts.clear(); pending = {}; inFlight = {}; invalid.clear(); Object.keys(invalidValues).forEach(id => delete invalidValues[id]); conflict = false; }

function renderHome() {
  const svg = paths => '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + paths + '</svg>';
  const icons = {
    operating:svg('<path d="M10 33V23a14 14 0 0 1 28 0v10Z" fill="currentColor" fill-opacity=".12"/><path d="M15 25a9 9 0 0 1 18 0M24 25l6-7M24 13v2M13 20l2 1M35 20l-2 1"/><circle cx="24" cy="25" r="2" fill="currentColor"/><path d="M7 37h21"/><g class="icon-highlight"><path d="m36 30 1 3 3 1-1 3 1 3-3 1-1 3-3-1-3 1-1-3-3-1 1-3-1-3 3-1 1-3 3 1Z" fill="currentColor" fill-opacity=".15"/><circle cx="33" cy="37" r="3"/></g>'),
    janitorial:svg('<path d="M12 18h13v5l4 5v13H10V28l4-5v-5M14 18v-6h11l6 4-2 4-6-2M16 29h7v6h-7" fill="currentColor" fill-opacity=".12"/><path d="M15 12V8h11M31 14l4-2M32 19l4 1"/><g class="icon-highlight"><path d="m38 25 1.5 4.5L44 31l-4.5 1.5L38 37l-1.5-4.5L32 31l4.5-1.5ZM36 5v6M33 8h6"/></g>'),
    dewatering:svg('<path d="M7 18h34v18H7z" fill="currentColor" fill-opacity=".12"/><path d="M13 18v18M19 18v18M25 18v18M31 18v18M37 18v18M6 14h36M10 36v5M38 36v5M20 10h8M24 6v8"/><g class="icon-highlight"><path d="M24 35v4M19 43h10M5 26H2M46 26h-3"/><path d="M35 4s-3 4-3 6a3 3 0 0 0 6 0c0-2-3-6-3-6Z" fill="currentColor" fill-opacity=".25"/></g>')
  };
  $('worksheets').innerHTML = catalog.worksheets.map(w => {
    const items = catalog.items.filter(i => i.sourceSheet === w.sourceSheet);
    const places = new Set(items.map(i => i.location)).size;
    return `<button class="worksheet-card" data-worksheet="${w.id}"><span class="worksheet-icon" aria-hidden="true">${icons[w.id]}</span><span><strong>${escapeHtml(w.name)}</strong><small>${items.length} supplies · ${places} ${places === 1 ? 'location' : 'locations'}</small></span><span class="worksheet-arrow" aria-hidden="true">→</span></button>`;
  }).join('');
}
function renderHistory() {
  $('history-title').textContent = mode === 'home' ? 'Recent inventories' : 'Inventory history';
  const rows = mode === 'home' ? records.slice(0, 3) : records;
  $('history-list').innerHTML = rows.length ? rows.map(r => `<article class="history-card"><div class="history-top"><strong>${escapeHtml(worksheetName(r.worksheet))}</strong><span class="badge ${r.status === 'complete' ? 'ok' : ''}">${r.status === 'complete' ? 'Completed' : 'Draft'}</span></div><p>${escapeHtml(prettyDate(r.date))} · ${escapeHtml(r.operator)}<br>${r.low} at / below PAR</p><div class="history-bottom"><span>${r.counted} of ${r.total} counted</span><div class="history-controls"><button data-open="${r.id}">${r.status === 'complete' ? 'View' : 'Resume'} →</button><button class="trash-button" data-delete="${r.id}" aria-label="Delete ${escapeHtml(worksheetName(r.worksheet))} inventory from ${escapeHtml(prettyDate(r.date))} by ${escapeHtml(r.operator)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></div></div><button class="report-button" data-report="${r.id}">${r.status === 'complete' ? 'Order Needed' : 'Draft order report'} (${r.low})</button></article>`).join('') : '<div class="empty">No inventories yet.<br>Choose a worksheet on Home to start your first count.</div>';
}
function renderOrderReport(inventory) {
  reportInventory = structuredClone(inventory);
  if (!$('report-recipient').value) $('report-recipient').value = emailConfig.defaultTo;
  $('send-report-email').disabled = !emailConfig.enabled || sendingReport;
  $('report-recipient').disabled = !emailConfig.enabled || sendingReport;
  $('report-email-status').textContent = emailConfig.enabled ? 'Sends this report when you press the button.' : 'Email sending is not enabled yet. Ask the app administrator to set it up.';
  const entered = item => typeof inventory.counts[item.id] === 'number';
  const needed = inventory.items.filter(item => entered(item) && typeof item.par === 'number' && inventory.counts[item.id] <= item.par);
  const review = inventory.items.filter(item => item.par === null);
  const remaining = inventory.items.filter(item => !entered(item)).length;
  $('report-session').textContent = worksheetName(inventory.worksheet) + ' | ' + prettyDate(inventory.date) + ' | ' + inventory.operator;
  $('report-summary').textContent = needed.length ? needed.length + (needed.length === 1 ? ' item needs ordering' : ' items need ordering') : 'No counted items are at or below PAR.';
  $('report-note').textContent = (inventory.status === 'complete' ? 'Completed inventory. ' : 'Draft report: ' + remaining + (remaining === 1 ? ' item still uncounted. ' : ' items still uncounted. ')) + 'Items at or below PAR are listed below. Quantities use the worksheet count size.';
  function card(item, manual = false) {
    item = InventoryPackSizes.normalize(item);
    const count = entered(item) ? inventory.counts[item.id] : 'Not counted';
    const detail = [item.company, item.itemNumber && '#' + item.itemNumber, InventoryPackSizes.format(item) && 'Pack: ' + InventoryPackSizes.format(item)].filter(Boolean).join(' | ');
    return '<article class="report-item"><h3>' + escapeHtml(item.description) + '</h3><p class="report-location">' + escapeHtml(item.location) + '</p><div class="report-quantities"><span>On hand <strong>' + escapeHtml(count) + '</strong></span><span>' + (manual ? 'Rule <strong>' + escapeHtml(item.parNote || 'As needed') : 'PAR <strong>' + escapeHtml(item.par)) + '</strong></span></div><p class="report-unit">Count size: <strong>' + escapeHtml(InventoryPackSizes.countSize(item) || 'Not specified') + '</strong></p>' + (detail ? '<p class="report-detail">' + escapeHtml(detail) + '</p>' : '') + '</article>';
  }
  $('report-items').innerHTML = needed.length ? needed.map(item => card(item)).join('') : '<div class="empty">No items on the order list.</div>';
  $('report-review').innerHTML = review.length ? '<h2 class="report-review-title">Review as needed</h2><p class="report-note">These items have no numeric PAR. Check whether supplies are needed.</p>' + review.map(item => card(item,true)).join('') : '';
  showMode('report');
}
$('report-back').addEventListener('click', () => navigate('history'));
$('email-report-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (sendingReport || !reportInventory || !emailConfig.enabled) return;
  const inventory = reportInventory, to = $('report-recipient').value.trim();
  sendingReport = true; $('send-report-email').disabled = true; $('report-recipient').disabled = true;
  $('report-email-status').textContent = 'Sending report...';
  try {
    const result = await api(`/api/inventories/${inventory.id}/email`, {method:'POST',body:JSON.stringify({to,revision:inventory.revision})});
    const message = `Email accepted for sending to ${result.to} (${worksheetName(inventory.worksheet)}, ${prettyDate(inventory.date)}).`;
    if (reportInventory?.id === inventory.id) $('report-email-status').textContent = message;
    else notify(message);
  } catch (error) {
    if (reportInventory?.id === inventory.id) $('report-email-status').textContent = error.message;
    else notify(error.message);
  } finally {
    sendingReport = false; $('send-report-email').disabled = !emailConfig.enabled; $('report-recipient').disabled = !emailConfig.enabled;
  }
});
$('history-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-report]'); if (!button || navigating || completing) return;
  navigating = true; button.disabled = true;
  try { await flush(); const inventory = await api('/api/inventories/' + button.dataset.report); notify(); renderOrderReport(inventory); }
  catch (error) { notify(error.message); }
  finally { navigating = false; button.disabled = false; }
});
async function history() {
  const request = ++historyRequest;
  const latest = await api('/api/inventories');
  if (request !== historyRequest) return;
  records = latest; renderHistory();
}
function showMode(next) {
  mode = next;
  $('topbar').hidden = next === 'editor';
  $('count-status').hidden = next !== 'editor';
  $('home-view').hidden = next !== 'home'; $('workspace').hidden = next !== 'editor'; $('history-view').hidden = !['home','history'].includes(next);
  $('item-manager').hidden = next !== 'manage';
  $('order-report').hidden = next !== 'report';
  for (const name of ['home', 'history']) { const button = $('nav-' + name); if (next === name || (next === 'report' && name === 'history')) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); }
  renderHistory(); $('app-scroll').scrollTo({ top:0, behavior:'instant' });
}
function renderOverview() {
  if (!run) return;
  const items = run.items, done = counted(items), places = locations(), isComplete = run.status === 'complete';
  $('worksheet-label').textContent = isComplete ? 'COMPLETED WORKSHEET' : 'INVENTORY IN PROGRESS';
  $('run-title').textContent = worksheetName(run.worksheet);
  $('session-info').textContent = `${prettyDate(run.date)} · ${run.operator}`;
  $('baseline-info').textContent = run.sourceInventoryDate ? `Previous counts from ${prettyDate(run.sourceInventoryDate)} are shown for reference. Enter today’s quantity for each item.` : 'Enter today’s quantity for each item.';
  $('stat-counted').textContent = done; $('stat-remaining').textContent = items.length - done;
  $('stat-low').textContent = items.filter(i => status(i)[0] === 'low').length;
  $('run-progress').max = items.length; $('run-progress').value = done;
  const canComplete = done === items.length;
  $('complete').hidden = isComplete || !canComplete;
  $('complete').disabled = saving || completing || navigating || conflict || invalid.size > 0;
  $('next-location').hidden = isComplete || (canComplete && places.indexOf(locationName) === places.length - 1);
  $('next-location').disabled = completing || conflict;
  $('next-location').textContent = places.indexOf(locationName) < places.length - 1 ? 'Next location →' : 'Find uncounted items →';
  $('footer-copy').textContent = isComplete ? 'Completed and saved · read-only' : invalid.size ? 'Correct the highlighted counts before finishing.' : `${done} of ${items.length} counted · Blank means uncounted.`;
  $('location-select').innerHTML = places.map(name => {
    const group = items.filter(i => i.location === name);
    return `<option value="${escapeHtml(name)}" ${name === locationName ? 'selected' : ''}>${escapeHtml(name)} · ${counted(group)}/${group.length}</option>`;
  }).join('');
  const group = items.filter(i => i.location === locationName);
  $('location-progress').textContent = `${counted(group)} of ${group.length} counted here`;
}
function productPhoto(item) {
  if (!SHOW_PRODUCT_IMAGES) return '';
  const photo = catalog.images?.[item.id];
  if (!photo || !['workbook-link','user-provided'].includes(photo.sourceType) || InventoryPackSizes.normalize({...photo,id:item.id}).description !== item.description || (photo.itemNumber !== item.itemNumber && !photo.allowedItemNumbers?.includes(item.itemNumber))) return '';
  return '<a class="product-photo" href="' + escapeHtml(photo.productUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Supplier photo and details: ' + escapeHtml(item.description) + '"><img src="' + escapeHtml(photo.src) + '" alt="' + escapeHtml(item.description) + ' supplier photo" width="72" height="72" loading="lazy" decoding="async"><span>Supplier photo</span></a>';
}
function renderItems() {
  if (!run) return;
  const group = run.items.filter(i => i.location === locationName);
  const visible = group;
  $('items').innerHTML = visible.length ? visible.map(i => {
    i = InventoryPackSizes.normalize(i);
    const [cls, label] = status(i), value = invalid.has(i.id) ? invalidValues[i.id] : countOf(i.id) ?? '';
    const packSize = (InventoryPackSizes.format(i) || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
    return `<article class="item-card"><div class="item-body"><div class="item-top">${productPhoto(i)}<h2 class="item-name">${escapeHtml(i.description)}</h2><span class="badge ${cls}" data-status="${i.id}">${label}</span></div></div><div class="count-row"><label for="count-${i.id}">How many on hand?<span class="unit-value">${escapeHtml(InventoryPackSizes.countSize(i) || "Count size unspecified")}</span>${packSize ? `<span class="unit-pack-size">${escapeHtml(packSize)}</span>` : ""}</label><div class="quantity-control"><input id="count-${i.id}" class="count-input ${invalid.has(i.id) ? "invalid" : ""}" ${invalid.has(i.id) ? 'aria-invalid="true"' : ""} data-id="${i.id}" aria-label="On hand: ${escapeHtml(i.description)}, ${escapeHtml(InventoryPackSizes.countSize(i) || "count size unspecified")}" type="number" min="0" max="1000000000" step="any" inputmode="decimal" enterkeyhint="next" placeholder="—" value="${escapeHtml(value)}" ${run.status === "complete" || conflict || completing || navigating ? "disabled" : ""}></div></div><div class="item-reference"><div class="previous-count" data-previous="${i.id}">Previous: <strong>${escapeHtml(run.previousCounts?.[i.id] ?? "No record")}</strong></div><div class="par-value">PAR: <strong>${escapeHtml(i.par ?? i.parNote)}</strong></div></div></article>`;
  }).join('') : '<div class="empty">No items in this location.</div>';
}
function render() { renderOverview(); renderItems(); }
async function flush(complete = false) {
  clearTimeout(timer);
  if (reviewingCount) throw new Error('Confirm or edit the highlighted count first.');
  if (saving) { while (saving) await new Promise(resolve => setTimeout(resolve, 40)); }
  if (conflict) throw new Error('This draft changed elsewhere. Your unsaved values remain visible. Reload to get the latest version.');
  if (invalid.size) throw new Error('Correct the highlighted counts before continuing.');
  if (!run || run.status === 'complete' || (!Object.keys(pending).length && !complete)) return;
  for (const [id, value] of Object.entries(pending)) {
    if (!unusualCount(run.previousCounts?.[id], value) || approvedCounts.get(id) === value) continue;
    // Let the operator finish typing before opening a review sheet.
    if (!complete && !navigating && document.activeElement?.dataset.id === id) return;
    reviewingCount = true;
    let confirmed;
    try { confirmed = await askAboutCount(run.items.find(item => item.id === id), value); }
    finally { reviewingCount = false; }
    if (!confirmed) {
      $('save-status').textContent = 'Count needs checking';
      setTimeout(() => {
        const item = run?.items.find(item => item.id === id);
        if (!item || mode !== 'editor') return;
        if (locationName !== item.location) selectLocation(item.location);
        document.querySelector(`[data-id="${id}"]`)?.focus({preventScroll:true});
        scheduleKeyboardLayout();
      }, 0);
      throw new Error('Edit the count before saving.');
    }
    approvedCounts.set(id, value);
  }
  const changes = pending; pending = {}; inFlight = changes; saving = true;
  $('save-status').textContent = 'Saving…'; renderOverview();
  try {
    run = await api(`/api/inventories/${run.id}`, { method:'PATCH', body:JSON.stringify({ revision:run.revision, counts:changes, ...(complete ? { status:'complete' } : {}) }) });
    $('save-status').textContent = 'All changes saved'; notify();
  } catch (error) {
    pending = { ...changes, ...pending }; conflict = error.status === 409;
    $('save-status').textContent = conflict ? 'Conflict · reload required' : 'Not saved';
    notify(error.message + (conflict ? ' Your unsaved values remain visible for reference. Reload before continuing.' : ' Keep this page open and retry saving.'));
    if (!conflict) {
      const retry = document.createElement('button'); retry.textContent = 'Retry save';
      retry.addEventListener('click', () => flush().then(history).catch(() => {})); $('notice').append(retry);
    }
    throw error;
  } finally { inFlight = {}; saving = false; renderOverview(); if (conflict) renderItems(); }
  if (Object.keys(pending).length) return flush(complete);
}
async function navigate(next) {
  if (navigating || completing) return;
  navigating = true; render();
  try { await flush(); showMode(next); history().catch(error => notify(error.message)); }
  catch (error) { if (!Object.keys(pending).length) notify(error.message); }
  finally { navigating = false; render(); }
}
function selectLocation(name) { locationName = name; render(); }
$('brand-home').addEventListener('click', () => navigate('home'));
$('back-home').addEventListener('click', () => navigate('home'));
$('nav-home').addEventListener('click', () => navigate('home'));
$('nav-history').addEventListener('click', () => navigate('history'));
$('location-select').addEventListener('change', event => selectLocation(event.target.value));
$('next-location').addEventListener('click', () => {
  const places = locations(), index = places.indexOf(locationName);
  const next = index < places.length - 1 ? places[index + 1] : run.items.find(i => countOf(i.id) === undefined || countOf(i.id) === null || invalid.has(i.id))?.location;
  if (next) selectLocation(next);
  $('app-scroll').scrollTo({ top:0, behavior:'instant' });
});
$('items').addEventListener('error', event => {
  if (event.target.matches('.product-photo img')) event.target.closest('.product-photo').hidden = true;
}, true);
$('items').addEventListener('input', event => {
  const input = event.target;
  if (!input.matches('[data-id]') || !run || completing || navigating) return;
  const id = input.dataset.id;
  approvedCounts.delete(id);
  if (input.validity.badInput || !input.validity.valid) {
    invalid.add(id); invalidValues[id] = input.value; input.classList.add('invalid'); input.setAttribute('aria-invalid','true'); $('save-status').textContent = 'Check highlighted counts';
  } else {
    invalid.delete(id); delete invalidValues[id]; input.classList.remove('invalid'); input.removeAttribute('aria-invalid'); pending[id] = input.value === '' ? null : Number(input.value); $('save-status').textContent = 'Unsaved changes…';
  }
  const item = run.items.find(i => i.id === id), [cls, label] = status(item);
  const badge = document.querySelector(`[data-status="${id}"]`); badge.className = 'badge ' + cls; badge.textContent = label;
  renderOverview(); clearTimeout(timer); timer = setTimeout(() => flush().then(history).catch(() => {}), 650);
});
$('items').addEventListener('focusout', event => {
  if (event.target.matches('[data-id]') && !reviewingCount) {
    clearTimeout(timer); timer = setTimeout(() => flush().then(history).catch(() => {}), 100);
  }
});
$('items').addEventListener('keydown', event => {
  if (event.key !== 'Enter' || !event.target.matches('[data-id]')) return;
  event.preventDefault(); const inputs = [...$('items').querySelectorAll('input:not(:disabled)')]; const next = inputs[inputs.indexOf(event.target) + 1];
  if (next) {
    next.focus({ preventScroll:true });
    scheduleKeyboardLayout();
  } else event.target.blur();
});

// The visual viewport can shrink for the keyboard without resizing the page.
let fullViewportHeight = window.visualViewport?.height || window.innerHeight;
let keyboardFrame;
function editingField() {
  const field = document.activeElement;
  return field?.matches('input:not([disabled]):not([type=button]):not([type=submit]), textarea') ? field : null;
}
function keepFieldVisible(field) {
  const viewport = window.visualViewport;
  const visibleTop = viewport?.offsetTop || 0;
  const visibleBottom = visibleTop + (viewport?.height || window.innerHeight);
  const dialog = field.closest('dialog');
  const scroller = dialog || $('app-scroll');
  const bounds = scroller.getBoundingClientRect();
  let top = Math.max(bounds.top, visibleTop) + 16;
  const bottom = Math.min(bounds.bottom, visibleBottom) - 20;
  // Allow room for the pinned location picker when the keyboard is closed.
  if (!dialog && !document.body.classList.contains('keyboard-open')) {
    const toolbar = $('location-select').closest('.location-toolbar').getBoundingClientRect();
    top = Math.max(top, toolbar.bottom + 12);
  }
  const rect = field.getBoundingClientRect();
  if (bottom <= top) return;
  const delta = rect.bottom > bottom ? rect.bottom - bottom : rect.top < top ? rect.top - top : 0;
  if (delta) scroller.scrollTo({ top:scroller.scrollTop + delta, behavior:'instant' });
}
function updateKeyboardLayout() {
  const field = editingField(), viewport = window.visualViewport;
  const height = Math.min(window.innerHeight, viewport?.height || window.innerHeight);
  const atNormalScale = !viewport || Math.abs(viewport.scale - 1) < 0.05;
  const keyboardOpen = Boolean(field && atNormalScale && fullViewportHeight - height > 120);
  document.body.classList.toggle('keyboard-open', keyboardOpen);
  if (field && atNormalScale) {
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    document.documentElement.style.setProperty('--visible-height', `${height}px`);
    // Safari may pan the visual viewport as well as shrink it for the keyboard.
    document.documentElement.style.setProperty('--app-offset-top', `${keyboardOpen ? viewport?.offsetTop || 0 : 0}px`);
    const keyboardInset = Math.max(0, window.innerHeight - ((viewport?.offsetTop || 0) + height));
    document.documentElement.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
  } else {
    document.documentElement.style.removeProperty('--app-height');
    document.documentElement.style.removeProperty('--visible-height');
    document.documentElement.style.removeProperty('--app-offset-top');
    document.documentElement.style.removeProperty('--keyboard-inset');
    if (!field) fullViewportHeight = Math.max(fullViewportHeight, height);
  }
  if (field) keepFieldVisible(field);
}
function scheduleKeyboardLayout() {
  cancelAnimationFrame(keyboardFrame);
  keyboardFrame = requestAnimationFrame(updateKeyboardLayout);
}
document.addEventListener('focusin', () => {
  scheduleKeyboardLayout();
  // Cover keyboard animations whose final viewport update arrives later.
  setTimeout(scheduleKeyboardLayout, 100);
  setTimeout(scheduleKeyboardLayout, 350);
});
document.addEventListener('focusout', scheduleKeyboardLayout);
window.addEventListener('resize', scheduleKeyboardLayout);
window.visualViewport?.addEventListener('resize', scheduleKeyboardLayout);
window.visualViewport?.addEventListener('scroll', scheduleKeyboardLayout);
$('worksheets').addEventListener('click', async event => {
  const button = event.target.closest('[data-worksheet]'); if (!button || navigating) return;
  try {
    await flush(); catalog = await api('/api/catalog'); renderHome(); selectedWorksheet = button.dataset.worksheet;
    const worksheet = catalog.worksheets.find(w => w.id === selectedWorksheet), items = catalog.items.filter(i => i.sourceSheet === worksheet.sourceSheet);
    $('new-worksheet-title').textContent = worksheet.name; $('new-worksheet-copy').textContent = `${items.length} supplies to count. Choose a date and enter your name to begin.`;
    const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    $('inventory-date').value = date.toISOString().slice(0,10); $('operator-name').value = run?.operator || ''; $('form-error').textContent = ''; $('new-dialog').showModal();
  } catch (error) { notify(error.message); }
});
$('cancel-new').addEventListener('click', () => $('new-dialog').close());
$('new-form').addEventListener('submit', async event => {
  event.preventDefault(); if (navigating) return; navigating = true; $('start-count').disabled = true;
  try {
    await flush();
    run = await api('/api/inventories', { method:'POST', body:JSON.stringify({ worksheet:selectedWorksheet, date:$('inventory-date').value, operator:$('operator-name').value }) });
    resetEdits(); locationName = run.items[0].location; $('new-dialog').close(); $('save-status').textContent = 'Draft saved'; notify(); showMode('editor'); history().catch(error => notify(error.message));
  } catch (error) { $('form-error').textContent = error.message; }
  finally { navigating = false; $('start-count').disabled = false; render(); }
});
$('history-list').addEventListener('click', async event => {
  const trash = event.target.closest('[data-delete]');
  if (!trash || navigating || deleting) return;
  navigating = true; trash.disabled = true;
  try {
    await flush();
    deleteTarget = await api('/api/inventories/' + trash.dataset.delete);
    $('delete-copy').textContent = worksheetName(deleteTarget.worksheet) + ' | ' + prettyDate(deleteTarget.date) + ' | ' + deleteTarget.operator + ' (' + (deleteTarget.status === 'complete' ? 'Completed' : 'Draft') + ')';
    $('delete-error').textContent = ''; $('delete-dialog').showModal();
  } catch (error) { notify(error.message); }
  finally { navigating = false; trash.disabled = false; }
});
$('cancel-delete').addEventListener('click', () => $('delete-dialog').close());
$('delete-dialog').addEventListener('cancel', event => { if (deleting) event.preventDefault(); });
$('delete-dialog').addEventListener('close', () => { if (!$('delete-dialog').open) deleteTarget = null; });
$('confirm-delete').addEventListener('click', async () => {
  if (!deleteTarget || deleting) return;
  deleting = true; navigating = true;
  $('confirm-delete').disabled = true; $('cancel-delete').disabled = true; $('delete-error').textContent = '';
  try {
    const id = deleteTarget.id;
    await api('/api/inventories/' + id, { method:'DELETE', body:JSON.stringify({ revision:deleteTarget.revision }) });
    if (run?.id === id) { run = null; resetEdits(); }
    ++historyRequest; // Ignore refreshes that started before this deletion.
    records = records.filter(r => r.id !== id); renderHistory();
    $('delete-dialog').close(); notify('Inventory deleted.');
    history().catch(error => notify('Inventory deleted. Could not refresh history: ' + error.message));
  } catch (error) {
    if (error.status === 404 || error.status === 409) {
      $('delete-dialog').close(); notify(error.message); history().catch(() => {});
    } else $('delete-error').textContent = error.message;
  } finally {
    deleting = false; navigating = false; $('confirm-delete').disabled = false; $('cancel-delete').disabled = false;
  }
});
$('history-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-open]'); if (!button || navigating) return;
  navigating = true; button.disabled = true;
  try { await flush(); run = await api('/api/inventories/' + button.dataset.open); resetEdits(); locationName = run.items.find(i => run.counts[i.id] === undefined)?.location || run.items[0].location; $('save-status').textContent = run.status === 'complete' ? 'Saved · read-only' : 'All changes saved'; notify(); showMode('editor'); }
  catch (error) { if (!Object.keys(pending).length) notify(error.message); }
  finally { navigating = false; button.disabled = false; render(); }
});
$('complete').addEventListener('click', async () => {
  completing = true; render();
  try { await flush(true); history().catch(error => notify(error.message)); notify(); renderOrderReport(run); }
  catch (error) { if (!Object.keys(pending).length) notify(error.message); }
  finally { completing = false; render(); }
});
$('refresh').addEventListener('click', () => history().catch(error => notify(error.message)));
window.addEventListener('beforeunload', event => { if (saving || Object.keys(pending).length || invalid.size) { event.preventDefault(); event.returnValue = ''; } });
async function init() {
  try { [catalog,emailConfig] = await Promise.all([api('/api/catalog'),api('/api/email-config')]); renderHome(); showMode('home'); await history(); }
  catch (error) { notify('Could not load inventory: ' + error.message); }
}
init();

// Catalog management uses revisions so one phone cannot overwrite another's edits.
let editingItem = null, removingItem = null, itemRevision = 0, itemBusy = false;
const itemFields = ['description','countSize','parNote','company','itemNumber','caseSize','productUrl'];
function renderManager() {
  const worksheet = catalog.worksheets.find(w => w.id === $('manager-worksheet').value);
  const items = catalog.items.filter(item => item.sourceSheet === worksheet?.sourceSheet);
  $('manager-list').innerHTML = items.length ? items.map(item => '<article class="manager-card"><h2>' + escapeHtml(item.description) + '</h2><p>' + escapeHtml(item.location) + ' &middot; ' + escapeHtml(item.countSize) + ' &middot; PAR: ' + escapeHtml(item.par === null ? 'As needed' : item.par) + '</p><div class="manager-actions"><button type="button" data-edit-item="' + item.id + '">Edit</button><button type="button" data-remove-item="' + item.id + '">Remove</button></div></article>').join('') : '<div class="empty">No items in this worksheet. Add an item to get started.</div>';
}
function updateNewLocation(focus = false) {
  const adding = $('item-location').value === '__new_location__';
  $('new-location-field').hidden = !adding;
  $('item-new-location').disabled = !adding;
  $('item-new-location').required = adding;
  if (adding && focus) $('item-new-location').focus();
}
function itemLocations(selected = '') {
  const worksheet = catalog.worksheets.find(w => w.id === $('item-worksheet').value);
  const locations = [...new Set(catalog.items.filter(i => i.sourceSheet === worksheet?.sourceSheet).map(i => i.location))];
  $('item-location').innerHTML = locations.map(location => '<option value="' + escapeHtml(location) + '">' + escapeHtml(location) + '</option>').join('') + '<option value="__new_location__">Add new location&hellip;</option>';
  if (locations.includes(selected)) $('item-location').value = selected;
  updateNewLocation();
}
async function openManager() {
  if (navigating) return;
  navigating = true;
  try {
    await flush(); catalog = await api('/api/catalog'); renderHome();
    const selected = $('manager-worksheet').value;
    $('manager-worksheet').innerHTML = catalog.worksheets.map(w => '<option value="' + w.id + '">' + escapeHtml(w.name) + '</option>').join('');
    if (selected) $('manager-worksheet').value = selected;
    renderManager(); notify(); showMode('manage');
  } catch (error) { notify(error.message); }
  finally { navigating = false; }
}
$('manage-items').addEventListener('click',openManager);
$('manager-back').addEventListener('click',() => navigate('home'));
$('manager-worksheet').addEventListener('change',renderManager);
$('item-worksheet').addEventListener('change',() => itemLocations($('item-location').value));
$('item-location').addEventListener('change',() => updateNewLocation(true));
function editItem(item = null) {
  editingItem = item; itemRevision = catalog.revision;
  $('item-dialog-title').textContent = item ? 'Edit item' : 'Add item';
  $('item-worksheet').innerHTML = $('manager-worksheet').innerHTML;
  $('item-worksheet').value = item ? catalog.worksheets.find(w => w.sourceSheet === item.sourceSheet).id : $('manager-worksheet').value;
  for (const field of itemFields) $('item-' + field).value = item?.[field] || '';
  $('item-par').value = item?.par ?? '';
  $('item-new-location').value = '';
  $('item-error').textContent = ''; itemLocations(item?.location || ''); $('item-dialog').showModal();
}
$('add-item').addEventListener('click',() => editItem());
$('cancel-item').addEventListener('click',() => { if (!itemBusy) $('item-dialog').close(); });
$('item-form').addEventListener('submit',async event => {
  event.preventDefault(); if (itemBusy) return;
  itemBusy = true; $('save-item').disabled = true;
  const body = {revision:itemRevision,worksheet:$('item-worksheet').value,par:$('item-par').value === '' ? null : Number($('item-par').value)};
  body.location = $('item-location').value === '__new_location__' ? $('item-new-location').value : $('item-location').value;
  for (const field of itemFields) body[field] = $('item-' + field).value;
  try {
    catalog = await api('/api/catalog/items' + (editingItem ? '/' + editingItem.id : ''),{method:editingItem ? 'PATCH' : 'POST',body:JSON.stringify(body)});
    $('manager-worksheet').value = body.worksheet; renderManager(); renderHome(); $('item-dialog').close(); notify('Item saved. Changes apply to new inventories.');
  } catch (error) { $('item-error').textContent = error.message; }
  finally { itemBusy = false; $('save-item').disabled = false; }
});
$('manager-list').addEventListener('click',event => {
  const edit = event.target.closest('[data-edit-item]'), remove = event.target.closest('[data-remove-item]');
  if (edit) editItem(catalog.items.find(i => i.id === edit.dataset.editItem));
  if (remove) {
    removingItem = catalog.items.find(i => i.id === remove.dataset.removeItem); itemRevision = catalog.revision;
    $('remove-item-copy').textContent = removingItem.description + ' ? ' + removingItem.location;
    $('remove-item-error').textContent = ''; $('remove-item-dialog').showModal();
  }
});
$('cancel-remove-item').addEventListener('click',() => { if (!itemBusy) $('remove-item-dialog').close(); });
$('confirm-remove-item').addEventListener('click',async () => {
  if (itemBusy || !removingItem) return;
  itemBusy = true; $('confirm-remove-item').disabled = true;
  try {
    catalog = await api('/api/catalog/items/' + removingItem.id,{method:'DELETE',body:JSON.stringify({revision:itemRevision})});
    renderManager(); renderHome(); $('remove-item-dialog').close(); notify('Item removed from new inventories.');
  } catch (error) { $('remove-item-error').textContent = error.message; }
  finally { itemBusy = false; $('confirm-remove-item').disabled = false; }
});
for (const id of ['item-dialog','remove-item-dialog']) $(id).addEventListener('cancel',event => { if (itemBusy) event.preventDefault(); });

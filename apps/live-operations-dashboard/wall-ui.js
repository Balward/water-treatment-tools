/* Presentation layer for the live API. No sample data or simulated connections. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const svg = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const statuses = [
    ['operational', 'In Service', '<path d="m5 12 4 4L19 6"/>'],
    ['warning', 'Warning', '<path d="M12 3 2 21h20L12 3ZM12 9v5M12 18h.01"/>'],
    ['out-of-service', 'Out Of Service', '<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8M16 8l-8 8"/>'],
    ['maintenance', 'Maintenance', '<path d="m14 6 4 4 4-4a7 7 0 0 1-9 9l-7 7-4-4 7-7a7 7 0 0 1 9-9l-4 4Z"/>'],
    ['offline', 'Offline', '<circle cx="12" cy="12" r="9"/><path d="M7 12h10"/>'],
  ];
  let snapshot = null, connected = false, lastSync = 0;
  let dark = false, viewing = new URLSearchParams(location.search).get('mode')?.toLowerCase() === 'tv';
  try { dark = localStorage.getItem('live-ops-wall-theme') === 'dark'; } catch { /* Storage is optional. */ }
  const dateTime = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(undefined, {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'not recorded';
  const equipmentUpdated = () => Math.max(0, ...(snapshot?.equipment || []).map(item => Date.parse(item.updatedAt) || 0));
  const desktopDisplay = matchMedia('(min-width:900px)');
  const editorQr = document.querySelector('.header-qr');
  const headerTools = editorQr.parentElement;
  const wallFooter = document.querySelector('.wall-footer');
  let hideHeader = new URLSearchParams(location.search).get('header') === 'hidden';
  if (!new URLSearchParams(location.search).has('header')) {
    try { hideHeader = localStorage.getItem('live-ops-hide-header') === 'true'; } catch { /* Storage is optional. */ }
  }
  function headerDisplay() {
    const hidden = hideHeader && desktopDisplay.matches;
    document.body.classList.toggle('header-hidden',hidden);
    if (hidden) wallFooter.append(editorQr);
    else headerTools.prepend(editorQr);
    byId('wallHeaderToggle').textContent = hidden ? 'Show Header' : 'Hide Header';
    byId('wallHeaderToggle').setAttribute('aria-expanded',String(!hidden));
    requestAnimationFrame(overflowNotes);
  }
  byId('wallHeaderToggle').addEventListener('click',() => {
    const focusWasInHeader = byId('equipmentBoardHeader').contains(document.activeElement);
    hideHeader = !hideHeader;
    try { localStorage.setItem('live-ops-hide-header',String(hideHeader)); } catch { /* Storage is optional. */ }
    if (new URLSearchParams(location.search).has('header')) {
      const url = new URL(location.href);url.searchParams.set('header',hideHeader ? 'hidden' : 'shown');history.replaceState(null,'',url);
    }
    headerDisplay();
    if (focusWasInHeader) byId('wallHeaderToggle').focus();
  });
  desktopDisplay.addEventListener('change',headerDisplay);
  function theme() {
    document.body.classList.toggle('wall-dark', dark);
    byId('opsLogo').src = dark ? '/assets/logos/logo-horizontal-white.png' : '/assets/logos/northglenn-horizontal.png';
  }
  function signals() {
    const stale = connected && lastSync > 0 && Date.now() - lastSync > 65000;
    const healthy = connected && navigator.onLine && !stale;
    const alert = byId('connectionAlert');
    alert.hidden = healthy;
    alert.textContent = !snapshot ? 'Connecting — waiting for equipment data.' : `${stale ? 'UPDATES DELAYED' : 'CONNECTION LOST'} · Showing saved statuses; verify equipment before relying on this board.`;
    document.body.classList.toggle('connection-warning', !healthy);
    byId('wallSyncTime').textContent = `Last connection check: ${lastSync ? new Date(lastSync).toLocaleTimeString(undefined, {hour:'numeric',minute:'2-digit'}) : 'awaiting data'}`;
    byId('lastUpdated').textContent = `Equipment updated: ${dateTime(equipmentUpdated() ? new Date(equipmentUpdated()).toISOString() : null)}`;
    byId('compactConnectionStatus').textContent = healthy
      ? 'Connected \u00b7 Checked ' + new Date(lastSync).toLocaleTimeString(undefined, {hour:'numeric',minute:'2-digit'})
      : snapshot ? 'Connection lost \u00b7 Showing saved statuses' : 'Connecting \u00b7 Waiting for equipment data';
    recentChanges();
    for (const item of snapshot?.equipment || []) {
      const tile = [...document.querySelectorAll('.equipment-card')].find(card => card.dataset.id === item.id);
      if (!tile) continue;
      const age = Date.now() - Date.parse(item.updatedAt);
      tile.classList.toggle('recent-change', Number.isFinite(age) && age >= 0 && age < 120000);
    }
  }
  function recentChanges() {
    const now = Date.now();
    const recent = (snapshot?.equipment || []).filter(item => {
      const age = now - Date.parse(item.updatedAt); return age >= 0 && age < 600000;
    }).sort((a,b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const output = byId('recentEquipmentChange');
    if (!recent.length) { output.textContent = 'No equipment changes in the past 10 minutes.'; return; }
    const item = recent[0];
    const entry = item.changeLog?.find(entry => Math.abs(Date.parse(entry.timestamp) - Date.parse(item.updatedAt)) < 1000);
    const status = entry?.changes?.some(change => change.field === 'status');
    const action = status ? 'changed to ' + (statuses.find(([key]) => key === item.status)?.[1] || item.status)
      : entry?.changes?.some(change => change.field === 'note') ? 'notes updated' : 'updated';
    const name = [...document.querySelectorAll('.equipment-card')].find(card => card.dataset.id === item.id)?.querySelector('.equipment-name')?.textContent || item.name;
    const minutes = Math.floor((now - Date.parse(item.updatedAt)) / 60000);
    output.textContent = name + ' ' + action + ' · ' + (minutes ? minutes + ' min ago' : 'Just now')
      + (recent.length > 1 ? ' · ' + (recent.length - 1) + ' other recent update' + (recent.length > 2 ? 's' : '') : '');
  }
  function overflowNotes() {
    document.querySelectorAll('.equipment-note-preview:not([hidden])').forEach(note => {
      const item = snapshot?.equipment.find(item => item.id === note.closest('.equipment-card').dataset.id);
      if (!item) return;
      note.style.removeProperty('max-height');
      note.style.removeProperty('margin-top');
      note.textContent = item.note.trim();
      note.closest('.equipment-card').removeAttribute('data-more-notes');
      if (window.matchMedia('(min-width:900px)').matches) {
        const lines=Math.min(viewing ? 6 : 3,Math.floor(note.clientHeight/parseFloat(getComputedStyle(note).lineHeight)));
        note.style.maxHeight=`${lines*parseFloat(getComputedStyle(note).lineHeight)}px`;
        if (!lines) {
          note.style.marginTop='0';
          note.closest('.equipment-card').dataset.moreNotes='true';
          return;
        }
      }
      if (note.scrollHeight <= note.clientHeight + 1) return;
      const marker = document.createElement('span'); marker.className = 'more-notes'; marker.textContent = ' … More notes';
      let text = item.note.trim();
      do {
        const shorter = text.trimEnd().replace(/\s+\S+$/, '');
        text = shorter === text ? text.slice(0, -1) : shorter;
        note.textContent = text; note.append(marker);
      } while (note.scrollHeight > note.clientHeight + 1 && text.length);
      note.closest('.equipment-card').dataset.moreNotes = 'true';
    });
  }
  function present() {
    if (!snapshot) return;
    const legend = byId('statusLegend');
    legend.replaceChildren();
    const total = document.createElement('div'); total.className = 'legend-total';
    const count = document.createElement('strong'); count.textContent = snapshot.equipment.length;
    const label = document.createElement('span'); label.textContent = 'assets'; total.append(count, label); legend.append(total);
    statuses.forEach(([key, label, path]) => {
      const stat = document.createElement('div'); stat.className = `legend-key status-${key}`;
      stat.innerHTML = `<i>${svg(path)}</i><span>${label}</span><b>${snapshot.equipment.filter(item => item.status === key).length}</b>`;
      legend.append(stat);
    });
    document.querySelectorAll('.equipment-card').forEach(card => {
      const item = snapshot.equipment.find(item => item.id === card.dataset.id);
      if (!item) return;
      const status = statuses.find(([key]) => key === item.status) || statuses[2];
      let symbol = card.querySelector('.equipment-status-symbol');
      if (!symbol) { symbol = document.createElement('span'); symbol.className = 'equipment-status-symbol'; card.append(symbol); }
      symbol.innerHTML = svg(status[2]); symbol.title = status[1]; symbol.setAttribute('aria-hidden', 'true');
      card.title = `Updated ${dateTime(item.updatedAt)}. Select for full notes.`;
    });
    signals(); requestAnimationFrame(overflowNotes);
  }
  function readEquipment(id) {
    const item = snapshot?.equipment.find(item => item.id === id);
    if (!item) return;
    byId('equipmentReadTitle').textContent = document.querySelector(`.equipment-card[data-id="${CSS.escape(id)}"] .equipment-name`)?.textContent || item.name;
    byId('equipmentReadStatus').textContent = statuses.find(([key]) => key === item.status)?.[1] || item.status;
    byId('equipmentReadNote').textContent = item.note || 'No operating notes.';
    byId('equipmentReadMaintenance').textContent = item.groupKey === 'filters' ? `Surface wash maintenance: ${item.swMaintenanceComplete ? 'Complete' : 'Incomplete'}${item.swMaintenanceComplete && item.swMaintenanceYear ? ' · '+item.swMaintenanceYear : ''}` : '';
    byId('equipmentReadMeta').textContent = `Updated ${dateTime(item.updatedAt)} · ${item.updatedBy || 'operator'}`;
    if (!byId('equipmentReadDialog').open) byId('equipmentReadDialog').showModal();
  }
  document.addEventListener('live-ops:state', event => { snapshot = event.detail; present(); });
  document.addEventListener('live-ops:connection', event => {
    connected = event.detail.connected;
    if (connected) lastSync = Date.now();
    signals();
  });
  document.querySelectorAll('[data-wall-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.body.classList.toggle('wall-viewing', viewing);
  // Capture before the existing editor handlers. Viewing mode cannot trigger edits.
  for (const type of ['click','keydown']) document.addEventListener(type, event => {
    if (!viewing || (type === 'keydown' && !['Enter',' '].includes(event.key))) return;
    const card = event.target.closest?.('.equipment-card');
    if (card) { event.preventDefault(); event.stopImmediatePropagation(); readEquipment(card.dataset.id); }
    else if (event.target.closest?.('#openCommentDrawerButton,.comment-card-actions')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('resize', () => requestAnimationFrame(overflowNotes));
  // Comment updates and connection banners can change the space left for rows.
  new ResizeObserver(() => requestAnimationFrame(overflowNotes)).observe(byId('equipmentContainer'));
  window.addEventListener('offline', () => { connected = false; signals(); });
  window.addEventListener('online', signals);
  setInterval(signals, 10000);
  theme(); signals(); headerDisplay();
})();

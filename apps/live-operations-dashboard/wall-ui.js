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
  function sizeFooterQr() {
    if (!document.body.classList.contains('header-hidden')) return;
    const height = wallFooter.getBoundingClientRect().bottom - document.querySelector('.comments-board').getBoundingClientRect().top;
    wallFooter.style.setProperty('--footer-qr-height',`${height}px`);
    // Keep the image square and use all space above the two-line label.
    const labelHeight = editorQr.querySelector('.header-qr-text').getBoundingClientRect().height;
    const size = Math.max(68,Math.floor(height - labelHeight - 18));
    document.body.style.setProperty('--footer-qr-size',`${size}px`);
  }
  const footerQrObserver = new ResizeObserver(() => requestAnimationFrame(sizeFooterQr));
  footerQrObserver.observe(document.querySelector('.comments-board'));
  footerQrObserver.observe(wallFooter);
  footerQrObserver.observe(byId('equipmentContainer'));
  let hideHeader = new URLSearchParams(location.search).get('header') === 'hidden';
  if (!new URLSearchParams(location.search).has('header')) {
    try { hideHeader = localStorage.getItem('live-ops-hide-header') === 'true'; } catch { /* Storage is optional. */ }
  }
  function headerDisplay() {
    const hidden = hideHeader && desktopDisplay.matches;
    document.body.classList.toggle('header-hidden',hidden);
    if (hidden) wallFooter.append(editorQr);
    else headerTools.prepend(editorQr);
    requestAnimationFrame(sizeFooterQr);
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
    const button = byId('wallThemeToggle');
    const label = dark ? 'Switch To Light Mode' : 'Switch To Dark Mode';
    button.setAttribute('aria-label',label);
    button.title = label;
    button.innerHTML = svg(dark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'
      : '<path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z"/>');
  }
  byId('wallThemeToggle').addEventListener('click',() => {
    dark = !dark;
    try { localStorage.setItem('live-ops-wall-theme',dark ? 'dark' : 'light'); } catch { /* Storage is optional. */ }
    theme();
  });
  function signals() {
    for(const card of document.querySelectorAll('.equipment-card')){
      const item=snapshot?.equipment.find(item=>item.id===card.dataset.id);
      let duration=card.querySelector('.equipment-duration');
      if(item?.status!=='out-of-service'||!Number.isFinite(Date.parse(item.statusSince))){duration?.remove();continue;}
      if(!duration){duration=document.createElement('p');duration.className='equipment-duration';card.querySelector('.equipment-name-row').append(duration);}
      const elapsed=Date.now()-Date.parse(item.statusSince);
      const minutes=Math.max(0,Math.floor(elapsed/60000)),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
      duration.textContent=Number.isFinite(elapsed)?'Out of Service \u00b7 '+(days?days+' '+(days===1?'Day':'Days'):hours?hours+' '+(hours===1?'Hour':'Hours'):minutes?minutes+' Min':'Just Now'):'Out of Service \u00b7 Start Unknown';
      duration.title=Number.isFinite(elapsed)?'Out of service since '+new Date(item.statusSince).toLocaleString():'No original status-change time was recorded.';
    }
    const stale = connected && lastSync > 0 && Date.now() - lastSync > 65000;
    const healthy = connected && navigator.onLine && !stale;
    const alert = byId('connectionAlert');
    alert.hidden = healthy;
    alert.textContent = !snapshot ? 'Connecting — waiting for equipment data.' : `${stale ? 'UPDATES DELAYED' : 'CONNECTION LOST'} · Showing saved statuses; verify equipment before relying on this board.`;
    document.body.classList.toggle('connection-warning', !healthy);
    const connectionCheckedAt=lastSync ? new Date(lastSync).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : 'awaiting data';
    byId('wallSyncTime').textContent = `Last connection check: ${connectionCheckedAt}`;
    byId('lastUpdated').textContent = `Equipment updated: ${dateTime(equipmentUpdated() ? new Date(equipmentUpdated()).toISOString() : null)}`;
    byId('compactConnectionStatus').textContent = healthy
      ? 'Connected \u00b7 Checked ' + connectionCheckedAt
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
    const recent = (snapshot?.equipment || []).flatMap(item=>(item.changeLog||[]).filter(entry=>Number.isFinite(Date.parse(entry.timestamp))).map(entry=>({item,entry})))
      .sort((a,b)=>Date.parse(b.entry.timestamp)-Date.parse(a.entry.timestamp));
    const output = byId('recentEquipmentChange');
    if (!recent.length) { output.textContent = snapshot ? 'No equipment changes recorded.' : 'Waiting for equipment data.'; output.removeAttribute('title'); return; }
    const {item,entry} = recent[0];
    const status = entry?.changes?.some(change => change.field === 'status');
    const statusValue=entry.changes.find(change=>change.field==='status')?.to;
    const action = status ? 'changed to ' + (statusValue==='Online'?'In Service':statusValue)
      : entry?.changes?.some(change => change.field === 'note') ? 'notes updated' : 'updated';
    const name = [...document.querySelectorAll('.equipment-card')].find(card => card.dataset.id === item.id)?.querySelector('.equipment-name')?.textContent || item.name;
    const minutes = Math.max(0,Math.floor((now - Date.parse(entry.timestamp)) / 60000));
    const hours=Math.floor(minutes/60),days=Math.floor(hours/24);
    const age=days ? days+' '+(days===1?'day':'days')+' ago' : hours ? hours+' hr ago' : minutes ? minutes+' min ago' : 'Just now';
    const author=entry?.updatedBy?.trim() || item.updatedBy?.trim() || 'Unknown operator';
    output.textContent = name + ' ' + action + ' \u00b7 by ' + author + ' \u00b7 ' + age;
    output.title='Updated '+new Date(entry.timestamp).toLocaleString()+' by '+author;
  }
  function overflowNotes() {
    document.querySelectorAll('.equipment-note-preview:not([hidden])').forEach(note => {
      const item = snapshot?.equipment.find(item => item.id === note.closest('.equipment-card').dataset.id);
      if (!item) return;
      note.style.removeProperty('max-height');
      note.style.removeProperty('margin-top');
      note.style.removeProperty('font-size');
      note.textContent = item.note.trim();
      note.closest('.equipment-card').removeAttribute('data-more-notes');
      // Preserve short operating notes in full when a modest reduction helps.
      // Long notes retain a readable size and the existing full-note affordance.
      if(desktopDisplay.matches){
        const preferred=parseFloat(getComputedStyle(note).fontSize);
        let low=Math.max(16,Math.floor(preferred*.8)),high=Math.floor(preferred);
        while(low<high){
          const size=Math.ceil((low+high)/2);note.style.fontSize=size+'px';
          if(note.scrollHeight<=note.clientHeight+1)low=size;else high=size-1;
        }
        note.style.fontSize=low+'px';
      }
      {
        const lineHeight = parseFloat(getComputedStyle(note).lineHeight);
        const lines = Math.floor(note.clientHeight / lineHeight);
        note.style.maxHeight=`${lines * lineHeight}px`;
        if (!lines) {
          note.style.marginTop='0';
          note.closest('.equipment-card').dataset.moreNotes='true';
          return;
        }
      }
      if (note.scrollHeight <= note.clientHeight + 1) return;
      const marker = document.createElement('span'); marker.className = 'more-notes'; marker.textContent = '\u2026\u2192';
      marker.setAttribute('role','img'); marker.setAttribute('aria-label','More notes');
      marker.title='Select the card to read the full note';
      const characters=Array.from(item.note.trim());
      function showPrefix(length){note.textContent=characters.slice(0,length).join('').trimEnd();note.append(marker);}
      // Fit to the final character instead of dropping whole words or reserving a label.
      let low=0,high=characters.length;
      while(low<high){
        const length=Math.ceil((low+high)/2);showPrefix(length);
        if(note.scrollHeight<=note.clientHeight+1 && note.scrollWidth<=note.clientWidth+1)low=length;
        else high=length-1;
      }
      showPrefix(low);
      note.closest('.equipment-card').dataset.moreNotes = 'true';
    });
  }
  let typographyFrame=0;
  function sizeEquipmentText(){
    typographyFrame=0;
    const cards=[...document.querySelectorAll('.equipment-card')].filter(card=>card.clientWidth && card.clientHeight);
    if(!cards.length)return;
    if(desktopDisplay.matches){
      const comments=document.querySelector('.comments-board');
      // Four equipment rows share the remaining height with one card-height comments panel.
      // This solves the new height directly instead of repeatedly chasing the resized cards.
      const height=(comments.getBoundingClientRect().height+4*cards[0].getBoundingClientRect().height)/5;
      document.body.style.setProperty('--matched-comments-height',height.toFixed(2)+'px');
    }else document.body.style.removeProperty('--matched-comments-height');
    for(const card of cards)card.style.setProperty('--board-watermark-size',Math.round(Math.min(card.clientHeight*1.05,card.clientWidth*.85))+'px');
    const width=Math.min(...cards.map(card=>card.clientWidth)),height=Math.min(...cards.map(card=>card.clientHeight));
    const minimum=14;
    const desired=desktopDisplay.matches?Math.max(20,Math.floor(Math.min(height*.24,width*.3))):19;
    function applyName(size){
      document.body.style.setProperty('--board-name-size',size+'px');
      for(const card of cards)card.querySelector('.equipment-name').style.fontSize=size+'px';
      document.body.style.setProperty('--board-icon-size',Math.max(18,Math.round(Math.min(size*.75,width*.14)))+'px');
    }
    function namesFit(){
      return cards.every(card=>{
        const name=card.querySelector('.equipment-name'),style=getComputedStyle(card),line=parseFloat(getComputedStyle(name).lineHeight);
        const space=card.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
        return name.getBoundingClientRect().height<=line+1 && card.querySelector('.equipment-head').getBoundingClientRect().height<=space+1 && name.scrollWidth<=name.clientWidth+1;
      });
    }
    // Keep every title on one line at the largest shared size that fits.
    let low=minimum,high=desired;
    while(low<high){const size=Math.ceil((low+high)/2);applyName(size);if(namesFit())low=size;else high=size-1;}
    applyName(low);
    if(desktopDisplay.matches)document.body.style.setProperty('--board-note-size',Math.max(16,Math.floor(Math.min(low*.64,height*.16)))+'px');
    else document.body.style.removeProperty('--board-note-size');
    overflowNotes();
  }
  function scheduleTypography(){if(!typographyFrame)typographyFrame=requestAnimationFrame(sizeEquipmentText);}
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
    signals(); scheduleTypography();
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
  window.addEventListener('resize',scheduleTypography);
  // Comment updates and connection banners can change the space left for rows.
  new ResizeObserver(scheduleTypography).observe(byId('equipmentContainer'));
  // Recovery can publish state before replacing the unavailable-state markup.
  // Present newly mounted cards too; ignore our own note text/icon mutations.
  new MutationObserver(records=>{
    if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1 && (node.matches('.equipment-card') || node.querySelector('.equipment-card')))))present();
  }).observe(byId('equipmentContainer'),{childList:true,subtree:true});
  document.fonts.ready.then(scheduleTypography);
  window.addEventListener('offline', () => { connected = false; signals(); });
  window.addEventListener('online', signals);
  setInterval(signals, 10000);
  theme(); signals(); headerDisplay();
})();

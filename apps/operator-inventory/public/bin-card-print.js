'use strict';
const requestedCards = new Set(new URLSearchParams(location.search).getAll('id'));
const printButton = document.getElementById('print-cards');
const reloadButton = document.getElementById('reload-cards');
const printStatus = document.getElementById('print-status');
const warnings = document.getElementById('print-warnings');
const sheets = document.getElementById('bin-sheets');
let printable = false;
function fitCards() {
  const overflow = [];
  for (const card of document.querySelectorAll('.bin-card')) {
    const title = card.querySelector('h2');
    if (title.getBoundingClientRect().height > 29) card.classList.add('bin-multiline');
    while (title.getBoundingClientRect().height > 40 && parseFloat(getComputedStyle(title).fontSize) > 13) title.style.fontSize = (parseFloat(getComputedStyle(title).fontSize) - .5) + 'px';
    const pack = card.querySelector('.bin-pack');
    if (pack.scrollWidth > pack.clientWidth + 1) card.classList.add('bin-wide-pack');
    for (const selector of ['.bin-pack','.bin-product']) {
      const el = card.querySelector(selector), minimum = selector === '.bin-pack' ? 8 : 10;
      while (el.scrollWidth > el.clientWidth + 1 && parseFloat(getComputedStyle(el).fontSize) > minimum) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) - .5) + 'px';
    }
    const meta = card.querySelector('.bin-meta');
    for (let pass = 0; pass < 8 && meta.offsetHeight > 90; pass++) {
      for (const selector of ['.bin-supplier','.bin-value']) {
        const el = card.querySelector(selector), size = parseFloat(getComputedStyle(el).fontSize);
        if (size > 10) el.style.fontSize = (size - .5) + 'px';
      }
    }
    const bounds = card.getBoundingClientRect();
    const clipped = [...card.querySelectorAll('h2,.bin-meta,.bin-pack,.bin-qr-link')].some(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > bounds.bottom - 3 || r.right > bounds.right - 3 || el.scrollWidth > el.clientWidth + 1;
    });
    if (clipped || meta.offsetHeight > 90) overflow.push(title.textContent);
  }
  return overflow;
}
function warn(message) { const li = document.createElement('li'); li.textContent = message; warnings.append(li); }
async function loadCards() {
  printable = false; printButton.disabled = true; reloadButton.disabled = true;
  delete document.documentElement.dataset.cardsReady;
  sheets.replaceChildren(); warnings.replaceChildren(); printStatus.textContent = 'Loading selected items…';
  try {
    if (!requestedCards.size) throw new Error('Choose items from Management → Print bin cards first.');
    const response = await fetch('./api/catalog',{cache:'no-store'});
    if (!response.ok) throw new Error('Could not load the current catalog. Try refreshing saved details.');
    const catalog = await response.json();
    const selected = InventoryBinCards.items(catalog).filter(i => requestedCards.has(i.id));
    if (!selected.length) throw new Error('None of the selected items are currently in Operating Supplies. Choose items again in Management.');
    if (selected.length !== requestedCards.size) warn((requestedCards.size - selected.length) + ' selected item(s) are no longer in Operating Supplies and were omitted.');
    for (const item of selected) {
      const issues = InventoryBinCards.details(item,catalog.images).issues;
      if (issues.length) warn(item.description + ': ' + issues.join('; ') + '.');
    }
    const pageCount = Math.ceil(selected.length / 6);
    for (let index = 0; index < selected.length; index += 6) {
      const sheet = document.createElement('section'); sheet.className = 'bin-sheet';
      const header = document.createElement('header'); header.className = 'bin-sheet-header';
      header.textContent = 'Operating Supplies · Bin cards — Page ' + (index / 6 + 1) + ' of ' + pageCount;
      const labels = document.createElement('div'); labels.className = 'bin-labels';
      labels.innerHTML = selected.slice(index,index + 6).map(item => InventoryBinCards.card(item,catalog.images)).join('');
      const footer = document.createElement('footer'); footer.className = 'bin-sheet-footer';
      footer.innerHTML = '<span>4 × 1¾ in · 100% / Actual size · Cut along the card borders</span><span class="bin-ruler">1 inch</span>';
      sheet.append(header,labels,footer); sheets.append(sheet);
    }
    await Promise.all([...sheets.querySelectorAll('img')].map(img => new Promise(resolve => {
      function finish() {
        if (!img.naturalWidth) {
          const replacement = document.createElement('span'); replacement.className = 'bin-missing'; replacement.textContent = 'Image unavailable'; img.replaceWith(replacement);
          warn('An image could not be loaded. Its card shows a placeholder.');
        }
        resolve();
      }
      if (img.complete) finish(); else { img.onload = finish; img.onerror = finish; }
    })));
    await document.fonts.ready;
    const overflow = fitCards();
    if (overflow.length) {
      overflow.forEach(name => warn(name + ': details exceed this card layout. Edit the item to use shorter text, then refresh.'));
      printStatus.textContent = 'Some text does not fit. Review the warnings before printing.';
    } else {
      printable = true; printButton.disabled = false;
      printStatus.textContent = selected.length + ' card(s) ready · ' + pageCount + ' page(s). Review the preview and any missing details before printing.';
    }
  } catch (error) { printStatus.textContent = error.message; }
  finally { reloadButton.disabled = false; document.documentElement.dataset.cardsReady = 'true'; }
}
printButton.addEventListener('click',() => { if (printable) window.print(); });
reloadButton.addEventListener('click',loadCards);
loadCards();

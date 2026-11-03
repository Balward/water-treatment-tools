'use strict';
// Shared by the management picker, print preview, and Node checks.
(function(root) {
  const node = typeof module === 'object' && module.exports;
  const packs = node ? require('./pack-sizes') : root.InventoryPackSizes;
  const productImages = node ? require('./product-images') : root.InventoryProductImages;
  const qrGenerator = node ? require('./vendor/qrcode') : root.qrcode;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const qrCache = new Map();
  function items(catalog) {
    const worksheet = catalog.worksheets.find(w => w.id === 'operating');
    return worksheet ? catalog.items.filter(i => i.sourceSheet === worksheet.sourceSheet).map(packs.normalize) : [];
  }
  function photo(item, images) {
    return productImages.find(item,images)?.src || '';
  }
  function productUrl(item) {
    try {
      const url = new URL(productImages.productUrl(item.productUrl));
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return '';
      // Remove Amazon tracking while preserving the exact product identifier.
      const amazon = /(^|\.)amazon\.com$/i.test(url.hostname) && url.pathname.match(/\/(?:dp|gp\/product)\/([a-z0-9]{10})(?:\/|$)/i);
      return amazon ? url.origin + '/dp/' + amazon[1] : url.href;
    } catch { return ''; }
  }
  function qrImage(url) {
    if (!url) return '';
    if (!qrCache.has(url)) {
      try {
        const qr = qrGenerator(0,'M'); qr.addData(url); qr.make();
        const svg = qr.createSvgTag({cellSize:4,margin:16,scalable:true});
        qrCache.set(url,'data:image/svg+xml;base64,' + (node ? Buffer.from(svg).toString('base64') : btoa(svg)));
      } catch { qrCache.set(url,''); }
    }
    return qrCache.get(url);
  }
  function details(original, images) {
    const item = packs.normalize(original), image = photo(item,images), url = productUrl(item), qr = qrImage(url);
    const number = item.itemNumber && item.itemNumber !== 'N/A' ? item.itemNumber : '';
    const issues = [];
    if (!image) issues.push('Photo unavailable');
    if (!url) issues.push('No product link');
    else if (!qr) issues.push('Product link is too long for a QR code');
    if (!number) issues.push('No product number');
    if (!item.company) issues.push('Supplier unspecified');
    if (!item.caseSize) issues.push('Pack size unavailable');
    return {item,image,url,qr,number,issues};
  }
  function card(original, images) {
    const {item,image,url,qr,number} = details(original,images);
    const par = typeof item.par === 'number' ? `${item.par} ${item.countSize || ''}`.trim() : item.parNote || 'As needed';
    const pack = item.caseSize ? item.caseSize.replace(/\s*\(([^)]+)\)\s*$/, ' · $1') : 'Pack size unavailable';
    return '<article class="bin-card" data-id="' + escape(item.id) + '"><h2>' + escape(item.description) + '</h2><div class="bin-card-body"><span class="bin-photo-frame">' + (image ? '<img class="bin-photo" src="' + escape(image) + '" alt="' + escape(item.description) + '">' : '<span class="bin-missing">Photo unavailable</span>') + '</span><div class="bin-meta"><p class="bin-supplier"><strong>' + escape(item.company || 'Supplier unspecified') + '</strong></p><p class="bin-product">' + (number ? '#' + escape(number) : '<span class="bin-missing-number">No product number</span>') + '</p><div class="bin-par"><span class="bin-label">PAR</span><strong class="bin-value">' + escape(par) + '</strong></div></div>' + (qr ? '<a class="bin-qr-link" href="' + escape(url) + '" target="_blank" rel="noopener noreferrer"><img class="bin-qr" src="' + qr + '" alt="Product page QR"><span>Product page</span></a>' : '<div class="bin-qr-link bin-no-link">' + (url ? 'QR unavailable' : 'No product link') + '</div>') + '<p class="bin-pack">' + escape(pack) + '</p></div></article>';
  }
  const api = {items,details,card,productUrl};
  if (node) module.exports = api; else root.InventoryBinCards = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

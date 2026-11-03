'use strict';
// A display-name edit does not change a product's photo identity.
(function(root) {
  const node = typeof module === 'object' && module.exports;
  const packs = node ? require('./pack-sizes') : root.InventoryPackSizes;
  const hasNumber = value => typeof value === 'string' && Boolean(value.trim()) && !/^(n\/?a|none|-)$/i.test(value.trim());
  function productUrl(value) {
    try {
      const url=new URL(value);
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return '';
      if(url.hostname==='sea.hach.com'){url.hostname='www.hach.com';url.protocol='https:';url.port='';}
      return url.href;
    }catch{return '';}
  }
  function find(original, images) {
    const item = packs.normalize(original), photo = images?.[item.id];
    if (!photo || !['workbook-link','user-provided'].includes(photo.sourceType) || !/^\/images\/s[123]-r\d+\.(jpg|png|webp|gif)$/.test(photo.src)) return null;
    const normalized = packs.normalize({...photo,id:item.id});
    if (hasNumber(item.itemNumber)) {
      const numbers = [photo.itemNumber,normalized.itemNumber,...(photo.allowedItemNumbers || [])].filter(hasNumber);
      return numbers.includes(item.itemNumber) ? {...photo,productUrl:productUrl(photo.productUrl)} : null;
    }
    // Products without a usable number still require the original identity.
    return photo.itemNumber === item.itemNumber && normalized.description === item.description ? {...photo,productUrl:productUrl(photo.productUrl)} : null;
  }
  const api = {find,productUrl};
  if (node) module.exports = api; else root.InventoryProductImages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

'use strict';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const SHOW_PRODUCT_IMAGES = true;
// Phone identity stays mobile in landscape; other browsers adapt to window width.
const phoneDevice = navigator.userAgentData?.mobile === true || /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(navigator.userAgent) || (!/Windows NT/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0 && Math.min(screen.width,screen.height) <= 600);
function updateLayout() {
  document.documentElement.dataset.layout = !phoneDevice && window.innerWidth >= 900 ? 'desktop' : 'mobile';
}
updateLayout();
window.addEventListener('resize',updateLayout);
let catalog, run = null, selectedWorksheet = '', locationName = '', mode = 'home', records = [];
let pending = {}, inFlight = {}, timer, saving = false, conflict = false, completing = false, navigating = false;
const invalid = new Set(), invalidValues = {};
let deleteTarget = null, deleting = false, editingCompleted = false;
let historyRequest = 0;
let chemicalRecords, chemicalHistoryUnavailable = false;
let emailConfig = { enabled:false, defaultTo:'' }, reportInventory = null, sendingReport = false;
let orderList = {items:[],revision:0}, listBusy = false, removeListTarget = null, orderFilter='all';
const selectedOrders = new Set();
function updateOrderSelection() {
  const entries = orderList.items.filter(entry => selectedOrders.has(entry.id));
  const missing = entries.filter(entry => !orderReady(entry)).length;
  $('order-selection-summary').textContent = entries.length + ' selected' + (missing ? ' / Set quantities for ' + missing + ' selected items before marking ordered.' : '');
  $('review-all-orders').disabled = !entries.length || listBusy;
  $('mark-selected-ordered').disabled = !entries.length || missing > 0 || listBusy;
  document.querySelectorAll('[data-review-supplier]').forEach(button => {
    button.disabled = listBusy || !entries.some(entry => orderingSupplier(entry.item).toLowerCase() === button.dataset.reviewSupplier);
  });
}
function listContains(item) {
  return orderList.items.some(entry => entry.item.id === item.id && entry.item.description === item.description && entry.item.itemNumber === item.itemNumber && entry.item.company === item.company && entry.item.countSize === item.countSize);
}
function updateListButtons() {
  document.querySelectorAll('[data-add-list]').forEach(button => {
    const item = reportInventory?.items.find(item => item.id === button.dataset.addList);
    const added = item && listContains(InventoryPackSizes.normalize(item));
    button.disabled = listBusy || Boolean(added);
    button.textContent = added ? 'On To Order List' : 'Add to List';
  });
}
function productPage(item) {
  return InventoryProductImages.productUrl(item.productUrl);
}
function orderingSupplier(item) {
  const link = productPage(item);
  if (link) {
    const host = new URL(link).hostname.toLowerCase();
    const domain = name => host === name || host.endsWith('.' + name);
    if (domain('hach.com')) return 'HACH';
    if (domain('vwr.com') || domain('avantorsciences.com')) return 'VWR';
    if (domain('amazon.com') || domain('a.co')) return 'Amazon';
    if (domain('evoqua.com')) return 'Evoqua';
    return host.replace(/^www\./,'');
  }
  return item.company?.trim() && item.company !== '???' ? item.company.trim() : 'Supplier not specified';
}
function groupedOrders(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const supplier = orderingSupplier(entry.item), key = supplier.toLowerCase();
    if (!groups.has(key)) groups.set(key,{supplier,key,entries:[]});
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()].sort((a,b) => a.supplier.localeCompare(b.supplier));
}
function purchaseUnit(entry) { return entry.orderUnit || entry.item.countSize || 'Each'; }
function orderReady(entry) { return (!entry.chemicalKey||Boolean(entry.deliveryDate&&entry.item.company?.trim())) && typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) && entry.quantity > 0 && Boolean(purchaseUnit(entry).trim()); }
function orderProductLink(item) {
  if(item.id?.startsWith('chemical-'))return escapeHtml(item.caseSize||'Chemical delivery');
  const url = productPage(item), number = item.itemNumber && item.itemNumber !== 'N/A' ? '#' + item.itemNumber : '';
  return url ? '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(number || 'Open product page') + '</a>' : escapeHtml(number) + ' <span class="missing-product-link">Product link not available</span>';
}
function purchaseReference(entry) {
  if(entry.chemicalKey)return 'Chemical Inventory / '+escapeHtml(prettyDate(entry.inventoryDate))+' / '+escapeHtml(entry.operator||'')+'<br>Recorded on hand: '+escapeHtml(entry.onHand)+' gal. Planned delivery: '+escapeHtml(prettyDate(entry.deliveryDate));
  if (!entry.inventoryDate) return 'Added manually. No inventory count is associated with this item.';
  return 'On hand when flagged: <strong>' + escapeHtml(entry.onHand ?? 'Not counted') + '</strong> / PAR: ' + escapeHtml(entry.item.par ?? entry.item.parNote) + '<br>Counted in ' + escapeHtml(entry.item.countSize) + '<br>' + escapeHtml(worksheetName(entry.worksheet)) + ' / ' + escapeHtml(prettyDate(entry.inventoryDate)) + ' / ' + escapeHtml(entry.operator || '') + (entry.inventoryStatus === 'draft' ? ' (Draft)' : '');
}
function chemicalOrderDetails(entry){
  const p=entry.planning,number=value=>typeof value==='number'?value.toLocaleString(undefined,{maximumFractionDigits:1}):'Unavailable';
  return '<p class="chemical-order-label">CHEMICAL &middot; ORDER DUE</p><div class="chemical-order-metrics"><span>On Hand<strong>'+number(p.gallons)+' gal</strong></span><span>Reorder Level<strong>'+number(p.threshold)+' gal</strong></span></div><p class="report-note">Order by '+escapeHtml(prettyDate(p.orderBy))+' &middot; Expected delivery '+escapeHtml(prettyDate(entry.deliveryDate))+'<br>Recent usage: '+number(p.rate)+' gal/day &middot; '+p.leadDays+'-day delivery notice<br>Based on '+escapeHtml(prettyDate(entry.inventoryDate))+' inventory. Confirm current levels.</p>'+p.warnings.map(text=>'<p class="chemical-order-warning">'+escapeHtml(text)+'</p>').join('');
}
function renderOrderList() {
  for (const id of selectedOrders) if (!orderList.items.some(entry => entry.id === id)) selectedOrders.delete(id);
  $('order-list-count').textContent = orderList.items.length ? ' (' + orderList.items.length + ')' : '';
  const unfinished = orderList.items.filter(entry => !orderReady(entry)).length;
  $('order-list-summary').textContent = orderList.items.length + (orderList.items.length === 1 ? ' item saved' : ' items saved') + (unfinished ? ' / ' + unfinished + ' need an order quantity.' : '. Quantities are ready for review.');
  $('review-all-orders').hidden = !orderList.items.length;
  const visible=orderList.items.filter(entry=>orderFilter==='all'||(orderFilter==='chemical'?!!entry.chemicalKey:!entry.chemicalKey));
  document.querySelectorAll('[data-order-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.orderFilter===orderFilter)));
  $('order-list-items').innerHTML = visible.length ? groupedOrders(visible).map(group => '<section class="supplier-group"><div class="supplier-heading"><h2>' + escapeHtml(group.supplier) + ' <small>' + group.entries.length + (group.entries.length === 1 ? ' item' : ' items') + '</small></h2><button class="text-button" type="button" data-review-supplier="' + escapeHtml(group.key) + '">Review selected &rarr;</button></div>' + group.entries.map(entry => {
    const item = entry.item;
    return '<article class="report-item'+(entry.chemicalKey?' chemical-order':'') + (selectedOrders.has(entry.id) ? ' selected-for-order' : '') + '"><label class="order-pick"><input type="checkbox" data-order-select="' + entry.id + '" ' + (selectedOrders.has(entry.id) ? 'checked' : '') + '><span>Ordering now</span></label><div class="report-item-top">' + productPhoto(item) + '<h3>' + escapeHtml(item.description) + '</h3></div>'+(entry.chemicalKey?chemicalOrderDetails(entry):'')+'<p class="report-detail">' + orderProductLink(item) + '</p><div class="purchase-quantity ' + (!orderReady(entry) ? 'needs-quantity' : '') + '"><span>Quantity to order</span><strong>' + escapeHtml(entry.quantity ?? 'Not set') + ' <small>' + escapeHtml(purchaseUnit(entry)) + '</small></strong>' + (item.caseSize ? '<p>' + escapeHtml(item.caseSize) + '</p>' : '') + '</div>' + (entry.notes ? '<p class="purchase-notes">' + escapeHtml(entry.notes) + '</p>' : '') + '<button class="edit-order-button" data-edit-order="' + entry.id + '" type="button" ' + (listBusy ? 'disabled' : '') + '>Edit order details</button><details class="inventory-reference"><summary>Source</summary><p class="report-note">' + purchaseReference(entry) + '</p></details><button class="remove-list-button" data-remove-list="' + entry.id + '" type="button" ' + (listBusy ? 'disabled' : '') + '>Remove from List</button></article>';
  }).join('') + '</section>').join('') : '<div class="empty">No pending items in this view.<br>Complete an inventory to add supplies at PAR or chemicals due for ordering.</div>';
  updateListButtons();
  updateOrderSelection();
  renderOrderedHistory();
}
document.querySelectorAll('[data-order-filter]').forEach(button=>button.onclick=()=>{orderFilter=button.dataset.orderFilter;renderOrderList();});
function renderOrderedHistory() {
  $('past-order-items').innerHTML = (orderList.orders || []).length ? orderList.orders.map(order => '<article class="past-order"><h3>' + escapeHtml(prettyDate(order.date)) + ' / ' + escapeHtml(order.operator) + '</h3>' + (order.reference ? '<p>' + escapeHtml(order.reference) + '</p>' : '') + groupedOrders(order.items).map(group => '<h4>' + escapeHtml(group.supplier) + '</h4><ul>' + group.entries.map(entry => '<li><strong>' + escapeHtml(entry.quantity) + ' ' + escapeHtml(purchaseUnit(entry)) + '</strong> / ' + escapeHtml(entry.item.description) + ' ' + orderProductLink(entry.item) + (entry.deliveryDate?'<p class="report-note">Expected Delivery: '+escapeHtml(prettyDate(entry.deliveryDate))+'</p>':'')+(entry.notes ? '<p class="purchase-notes">' + escapeHtml(entry.notes) + '</p>' : '') + '</li>').join('') + '</ul>').join('') + '<button class="add-history-item" data-add-history-item="' + order.id + '" type="button">+ Add item</button><button class="delete-order-button" data-delete-order="' + order.id + '" type="button">Delete order</button></article>').join('') : '<div class="empty">No orders recorded yet.</div>';
}
$('order-list-items').addEventListener('change', event => {
  const checkbox = event.target.closest('[data-order-select]'); if (!checkbox) return;
  if (checkbox.checked) selectedOrders.add(checkbox.dataset.orderSelect); else selectedOrders.delete(checkbox.dataset.orderSelect);
  checkbox.closest('.report-item').classList.toggle('selected-for-order',checkbox.checked);
  updateOrderSelection();
});
let orderedSelection = [], orderedRevision = 0;
$('mark-selected-ordered').addEventListener('click', () => {
  if (listBusy) return;
  orderedSelection = orderList.items.filter(entry => selectedOrders.has(entry.id));
  if (!orderedSelection.length || orderedSelection.some(entry => !orderReady(entry))) return;
  orderedRevision = orderList.revision;
  $('ordered-copy').textContent = orderedSelection.length + ' selected items: ' + groupedOrders(orderedSelection).map(group => group.supplier + ' (' + group.entries.length + ')').join(', ');
  const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  $('ordered-date').value = date.toISOString().slice(0,10);
  $('ordered-by').value = run?.operator || '';
  $('ordered-reference').value = ''; $('ordered-error').textContent = '';
  $('ordered-dialog').showModal();
});
$('cancel-ordered').addEventListener('click', () => { if (!listBusy) $('ordered-dialog').close(); });
$('ordered-dialog').addEventListener('cancel', event => { if (listBusy) event.preventDefault(); });
$('ordered-form').addEventListener('submit', async event => {
  if(!$('ordered-by').value.trim()){event.preventDefault();$('ordered-error').textContent='Choose an operator from the name list.';$('ordered-by').focus();return;}
  event.preventDefault(); if (listBusy) return;
  listBusy = true; $('confirm-ordered').disabled = true; $('cancel-ordered').disabled = true;
  try {
    orderList = await api('/api/order-list/ordered',{method:'POST',body:JSON.stringify({revision:orderedRevision,ids:orderedSelection.map(entry => entry.id),date:$('ordered-date').value,operator:$('ordered-by').value,reference:$('ordered-reference').value})});
    orderedSelection.forEach(entry => selectedOrders.delete(entry.id));
    $('ordered-dialog').close(); notifySuccess('Selected items recorded as ordered. The rest remain on your list.');
  } catch (error) { $('ordered-error').textContent = error.message; }
  finally { listBusy = false; $('confirm-ordered').disabled = false; $('cancel-ordered').disabled = false; renderOrderList(); }
});
async function refreshOrderList() {
  const latest = await api('/api/order-list');
  if (latest.revision >= orderList.revision) orderList = latest;
  renderOrderList();
}
let editingOrder = null, orderDetailsRevision = 0;
function openOrderDetails(entry) {
  editingOrder = entry; orderDetailsRevision = orderList.revision;
  $('order-details-name').textContent = entry.item.description;
  $('order-quantity').value = entry.quantity ?? '';
  $('order-unit').value = purchaseUnit(entry);
  $('order-notes').value = entry.notes || '';
  $('chemical-order-fields').hidden=!entry.chemicalKey;
  $('chemical-order-supplier').value=entry.chemicalKey?entry.item.company||'':'';
  $('chemical-order-delivery').value=entry.deliveryDate||'';
  $('chemical-order-delivery').required=!!entry.chemicalKey;
  $('chemical-order-delivery').disabled=!entry.chemicalKey;
  $('order-pack-reference').textContent = 'Pack size: ' + (entry.item.caseSize || 'Not specified') + '. Use the purchasing unit shown on the product page.';
  $('order-details-error').textContent = '';
  $('order-details-dialog').showModal();
}
$('order-list-items').addEventListener('click', event => {
  const edit = event.target.closest('[data-edit-order]');
  if (edit && !listBusy) {
    const entry = orderList.items.find(entry => entry.id === edit.dataset.editOrder);
    if (entry) openOrderDetails(entry);
  }
  const review = event.target.closest('[data-review-supplier]');
  if (review && !listBusy) openOrderReview(review.dataset.reviewSupplier).catch(error => notify(error.message));
});
$('cancel-order-details').addEventListener('click', () => { if (!listBusy) $('order-details-dialog').close(); });
$('order-details-dialog').addEventListener('cancel', event => { if (listBusy) event.preventDefault(); });
$('order-details-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!editingOrder || listBusy) return;
  listBusy = true; $('save-order-details').disabled = true; $('cancel-order-details').disabled = true;
  try {
    const quantity = $('order-quantity').value === '' ? null : Number($('order-quantity').value);
    orderList = await api('/api/order-list/' + editingOrder.id,{method:'PATCH',body:JSON.stringify({revision:orderDetailsRevision,quantity,orderUnit:$('order-unit').value.trim(),notes:$('order-notes').value,...(editingOrder.chemicalKey?{supplier:$('chemical-order-supplier').value,deliveryDate:$('chemical-order-delivery').value}:{})})});
    $('order-details-dialog').close(); notifySuccess('Order details saved.');
  } catch (error) {
    $('order-details-error').textContent = error.message + (error.status === 409 ? ' Your edits are still here. Copy them if needed, then cancel and refresh the list before editing again.' : '');
  } finally {
    listBusy = false; $('save-order-details').disabled = false; $('cancel-order-details').disabled = false; renderOrderList();
  }
});
let reviewSupplier = null, reviewSelection = [];
function renderPurchaseReview() {
  const groups = groupedOrders(orderList.items.filter(entry => reviewSelection.includes(entry.id))).filter(group => reviewSupplier === null || group.key === reviewSupplier);
  const entries = groups.flatMap(group => group.entries), missing = entries.filter(entry => !orderReady(entry)).length;
  $('order-review-title').textContent = reviewSupplier === null ? 'Review selected items' : (groups[0]?.supplier || 'Supplier') + ' order';
  $('order-review-summary').textContent = entries.length + (entries.length === 1 ? ' item / ' : ' items / ') + (missing ? missing + ' still need quantities. Return to To Order List to finish them before printing.' : 'All quantities set. Check the purchasing units and product pages before buying.');
  $('print-order-review').disabled = !entries.length || missing > 0 || entries.length !== reviewSelection.length;
  $('order-review-items').innerHTML = groups.length ? groups.map(group => '<section class="purchase-review-group"><h2>' + escapeHtml(group.supplier) + '</h2><div class="purchase-table-scroll"><table class="purchase-table"><thead><tr><th scope="col">Item</th><th scope="col">Order quantity</th><th scope="col">Notes</th></tr></thead><tbody>' + group.entries.map(entry => '<tr><td><div class="review-product">' + productPhoto(entry.item) + '<div><strong>' + escapeHtml(entry.item.description) + '</strong><p>' + orderProductLink(entry.item) + '</p><small>' + escapeHtml(entry.item.caseSize || '') + '</small>'+(entry.deliveryDate?'<p>Expected Delivery: '+escapeHtml(prettyDate(entry.deliveryDate))+'</p>':'')+'</div></div></td><td><strong class="review-quantity">' + escapeHtml(entry.quantity ?? 'Not set') + '</strong><br>' + escapeHtml(purchaseUnit(entry)) + '</td><td class="purchase-notes">' + escapeHtml(entry.notes || '') + '</td></tr>').join('') + '</tbody></table></div></section>').join('') : '<div class="empty">No items to review.</div>';
}
async function openOrderReview(supplier = null) {
  await refreshOrderList(); reviewSupplier = supplier; reviewSelection = orderList.items.filter(entry => selectedOrders.has(entry.id) && (supplier === null || orderingSupplier(entry.item).toLowerCase() === supplier)).map(entry => entry.id);
  if (!reviewSelection.length) { notify('Select the items you are ordering first.'); return; }
  renderPurchaseReview(); showMode('order-review');
}
$('review-all-orders').addEventListener('click', () => openOrderReview().catch(error => notify(error.message)));
$('order-review-back').addEventListener('click', () => navigate('order-list'));
$('print-order-review').addEventListener('click', async () => {
  if (listBusy) return;
  try {
    await refreshOrderList(); renderPurchaseReview();
    if ($('print-order-review').disabled) return;
    $('order-review-items').querySelectorAll('img').forEach(img => { img.loading = 'eager'; });
    await Promise.all([...$('order-review-items').querySelectorAll('img')].map(img => img.decode?.().catch(() => {})));
    window.print();
  } catch (error) { notify(error.message); }
});
$('nav-order-list').addEventListener('click', () => navigate('order-list'));
$('to-order-tab').addEventListener('click', () => navigate('order-list'));
$('placed-orders-tab').addEventListener('click', () => navigate('order-history'));
let purchaseTargetOrder = null, purchasePickerRevision = 0;
function pickerAlreadyAdded(item) {
  const entries = purchaseTargetOrder ? purchaseTargetOrder.items : orderList.items;
  return entries.some(entry => entry.item.id === item.id && InventoryPackSizes.normalize(entry.item).description === item.description && entry.item.itemNumber === item.itemNumber && entry.item.company === item.company && InventoryPackSizes.countSize(entry.item) === item.countSize);
}
function updatePurchasePicker() {
  const previous = $('purchase-item').value, query = $('purchase-search').value.trim().toLowerCase();
  const items = catalog.items.filter(item => [item.description,item.itemNumber,item.company].some(value => String(value || '').toLowerCase().includes(query)));
  $('purchase-item').innerHTML = '<option value="">Choose an item</option>' + items.map(item => '<option value="' + escapeHtml(item.id) + '" ' + (pickerAlreadyAdded(item) ? 'disabled' : '') + '>' + escapeHtml(item.description + (item.itemNumber && item.itemNumber !== 'N/A' ? ' / #' + item.itemNumber : '') + (pickerAlreadyAdded(item) ? ' (Already added)' : '')) + '</option>').join('');
  if (items.some(item => item.id === previous && !pickerAlreadyAdded(item))) $('purchase-item').value = previous;
  updatePurchasePreview();
}
function updatePurchasePreview() {
  const item = catalog.items.find(item => item.id === $('purchase-item').value);
  $('purchase-item-preview').innerHTML = item ? '<div class="report-item-top">' + productPhoto(item) + '<div><strong>' + escapeHtml(item.description) + '</strong><p class="report-detail">' + orderProductLink(item) + '</p><p class="report-note">Pack: ' + escapeHtml(item.caseSize || 'Not specified') + '</p></div></div>' : '';
}
async function openPurchasePicker(orderId = null) {
  if (listBusy) return;
  listBusy = true;
  try {
    const [latestCatalog] = await Promise.all([api('/api/catalog'),refreshOrderList()]);
    catalog = latestCatalog;
    purchaseTargetOrder = orderId ? orderList.orders.find(order => order.id === orderId) : null;
    if (orderId && !purchaseTargetOrder) throw new Error('This order was deleted. Refresh Placed Orders.');
    purchasePickerRevision = orderList.revision;
    $('add-purchase-title').textContent = purchaseTargetOrder ? 'Add item to order' : 'Add to List';
    $('add-purchase-context').textContent = purchaseTargetOrder ? 'Record a missing purchase on ' + prettyDate(purchaseTargetOrder.date) + (purchaseTargetOrder.reference ? ' / ' + purchaseTargetOrder.reference : '') + '. This updates history only; it does not place a purchase or remove pending items.' : 'Choose any catalog item, regardless of PAR or whether inventory has been taken.';
    $('purchase-search').value = ''; $('purchase-quantity').value = ''; $('purchase-unit').value = ''; $('purchase-notes').value = '';
    $('purchase-quantity').required = Boolean(purchaseTargetOrder);
    $('purchase-quantity-label').textContent = purchaseTargetOrder ? 'Quantity purchased' : 'Quantity to order (optional)';
    $('add-purchase-error').textContent = ''; updatePurchasePicker();
    $('add-purchase-dialog').showModal();
  } finally { listBusy = false; renderOrderList(); }
}
$('add-manual-item').addEventListener('click', () => openPurchasePicker().catch(error => notify(error.message)));
$('past-order-items').addEventListener('click', event => {
  const button = event.target.closest('[data-add-history-item]');
  if (button) openPurchasePicker(button.dataset.addHistoryItem).catch(error => notify(error.message));
});
$('purchase-search').addEventListener('input',updatePurchasePicker);
$('purchase-item').addEventListener('change', () => {
  const item = catalog.items.find(item => item.id === $('purchase-item').value);
  $('purchase-unit').value = item?.countSize || '';
  updatePurchasePreview();
});
$('cancel-purchase-item').addEventListener('click', () => { if (!listBusy) $('add-purchase-dialog').close(); });
$('add-purchase-dialog').addEventListener('cancel', event => { if (listBusy) event.preventDefault(); });
$('add-purchase-form').addEventListener('submit', async event => {
  event.preventDefault(); if (listBusy) return;
  listBusy = true; $('save-purchase-item').disabled = true; $('cancel-purchase-item').disabled = true;
  try {
    const route = purchaseTargetOrder ? '/api/order-history/' + purchaseTargetOrder.id + '/items' : '/api/order-list/manual';
    orderList = await api(route,{method:'POST',body:JSON.stringify({revision:purchasePickerRevision,itemId:$('purchase-item').value,quantity:$('purchase-quantity').value === '' ? null : Number($('purchase-quantity').value),orderUnit:$('purchase-unit').value,notes:$('purchase-notes').value})});
    $('add-purchase-dialog').close(); notifySuccess(purchaseTargetOrder ? 'Item added to the recorded order.' : 'Item added to the order list.');
  } catch (error) { $('add-purchase-error').textContent = error.message; }
  finally { listBusy = false; $('save-purchase-item').disabled = false; $('cancel-purchase-item').disabled = false; renderOrderList(); }
});
$('refresh-order-history').addEventListener('click', () => refreshOrderList().catch(error => notify(error.message)));
let deleteOrderTarget = null, deleteOrderRevision = 0;
$('past-order-items').addEventListener('click', event => {
  const button = event.target.closest('[data-delete-order]'); if (!button || listBusy) return;
  deleteOrderTarget = orderList.orders?.find(order => order.id === button.dataset.deleteOrder);
  if (!deleteOrderTarget) return;
  deleteOrderRevision = orderList.revision;
  $('delete-order-copy').textContent = prettyDate(deleteOrderTarget.date) + ' / ' + deleteOrderTarget.operator + (deleteOrderTarget.reference ? ' / ' + deleteOrderTarget.reference : '');
  $('delete-order-error').textContent = '';
  $('delete-order-dialog').showModal(); $('delete-order-title').focus({preventScroll:true});
});
$('cancel-delete-order').addEventListener('click', () => { if (!listBusy) $('delete-order-dialog').close(); });
$('delete-order-dialog').addEventListener('cancel', event => { if (listBusy) event.preventDefault(); });
$('confirm-delete-order').addEventListener('click', async () => {
  if (!deleteOrderTarget || listBusy) return;
  listBusy = true; $('confirm-delete-order').disabled = true; $('cancel-delete-order').disabled = true;
  try {
    orderList = await api('/api/order-history/' + deleteOrderTarget.id,{method:'DELETE',body:JSON.stringify({revision:deleteOrderRevision})});
    $('delete-order-dialog').close(); notifySuccess('Order deleted from history.');
  } catch (error) { $('delete-order-error').textContent = error.message; }
  finally { listBusy = false; $('confirm-delete-order').disabled = false; $('cancel-delete-order').disabled = false; renderOrderList(); }
});
$('refresh-order-list').addEventListener('click', () => refreshOrderList().catch(error => notify(error.message)));
$('order-report').addEventListener('click', async event => {
  if (event.target.closest('[data-open-order-list]')) { navigate('order-list'); return; }
  const button = event.target.closest('[data-add-list]');
  if (!button || listBusy || !reportInventory) return;
  listBusy = true; updateListButtons();
  try {
    orderList = await api('/api/order-list',{method:'POST',body:JSON.stringify({revision:orderList.revision,inventoryId:reportInventory.id,inventoryRevision:reportInventory.revision,itemId:button.dataset.addList})});
    renderOrderList(); notifySuccess(orderList.alreadyAdded ? 'This item is already on the order list.' : 'Added to the shared order list.');
  } catch (error) { notify(error.message); if (error.status === 409) await refreshOrderList().catch(() => {}); }
  finally { listBusy = false; renderOrderList(); }
});
$('order-list-items').addEventListener('click', event => {
  const button = event.target.closest('[data-remove-list]'); if (!button || listBusy) return;
  removeListTarget = orderList.items.find(entry => entry.id === button.dataset.removeList);
  if (!removeListTarget) return;
  $('remove-list-copy').textContent = removeListTarget.item.description;
  $('remove-list-dialog').showModal(); $('remove-list-title').focus({preventScroll:true});
});
$('cancel-remove-list').addEventListener('click', () => $('remove-list-dialog').close());
$('remove-list-dialog').addEventListener('cancel', event => { if (listBusy) event.preventDefault(); });
$('confirm-remove-list').addEventListener('click', async () => {
  if (!removeListTarget || listBusy) return;
  listBusy = true; $('confirm-remove-list').disabled = true; $('cancel-remove-list').disabled = true;
  try {
    orderList = await api('/api/order-list/' + removeListTarget.id,{method:'DELETE',body:JSON.stringify({revision:orderList.revision})});
    renderOrderList(); $('remove-list-dialog').close(); notifySuccess('Removed from the order list.');
  } catch (error) { $('remove-list-dialog').close(); notify(error.message); await refreshOrderList().catch(() => {}); }
  finally { listBusy = false; removeListTarget = null; $('confirm-remove-list').disabled = false; $('cancel-remove-list').disabled = false; renderOrderList(); }
});
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
let noticeTimer;
function notify(message = '', {success = false} = {}) {
  clearTimeout(noticeTimer);
  const notice = $('notice');
  notice.replaceChildren(); notice.hidden = !message;
  notice.dataset.kind = success ? 'success' : 'warning';
  if (!message) return;
  const text = document.createElement('span'); text.textContent = message;
  const dismiss = document.createElement('button');
  dismiss.type = 'button'; dismiss.className = 'dismiss-notice';
  dismiss.setAttribute('aria-label','Dismiss notification'); dismiss.textContent = '\u00d7';
  dismiss.addEventListener('click', () => notify());
  notice.append(text,dismiss);
  if (success) noticeTimer = setTimeout(() => notify(),5000);
}
function notifySuccess(message) { notify(message,{success:true}); }
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

  // Gauge and broom: Phosphor Regular (MIT). Press: custom matching SVG.
const inventoryIcons = {
  "operating": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M207.06,72.67A111.24,111.24,0,0,0,128,40h-.4C66.07,40.21,16,91,16,153.13V176a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V152A111.25,111.25,0,0,0,207.06,72.67ZM224,176H119.71l54.76-75.3a8,8,0,0,0-12.94-9.42L99.92,176H32V153.13c0-3.08.15-6.12.43-9.13H56a8,8,0,0,0,0-16H35.27c10.32-38.86,44-68.24,84.73-71.66V80a8,8,0,0,0,16,0V56.33A96.14,96.14,0,0,1,221,128H200a8,8,0,0,0,0,16h23.67c.21,2.65.33,5.31.33,8Z\"/></svg>",
  "janitorial": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\" fill=\"currentColor\"><path d=\"M235.5,216.81c-22.56-11-35.5-34.58-35.5-64.8V134.73a15.94,15.94,0,0,0-10.09-14.87L165,110a8,8,0,0,1-4.48-10.34l21.32-53a28,28,0,0,0-16.1-37,28.14,28.14,0,0,0-35.82,16,.61.61,0,0,0,0,.12L108.9,79a8,8,0,0,1-10.37,4.49L73.11,73.14A15.89,15.89,0,0,0,55.74,76.8C34.68,98.45,24,123.75,24,152a111.45,111.45,0,0,0,31.18,77.53A8,8,0,0,0,61,232H232a8,8,0,0,0,3.5-15.19ZM67.14,88l25.41,10.3a24,24,0,0,0,31.23-13.45l21-53c2.56-6.11,9.47-9.27,15.43-7a12,12,0,0,1,6.88,15.92L145.69,93.76a24,24,0,0,0,13.43,31.14L184,134.73V152c0,.33,0,.66,0,1L55.77,101.71A108.84,108.84,0,0,1,67.14,88Zm48,128a87.53,87.53,0,0,1-24.34-42,8,8,0,0,0-15.49,4,105.16,105.16,0,0,0,18.36,38H64.44A95.54,95.54,0,0,1,40,152a85.9,85.9,0,0,1,7.73-36.29l137.8,55.12c3,18,10.56,33.48,21.89,45.16Z\"/></svg>",
  "dewatering": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M8 7H4l-3 6h7M15 5V2h3M11 18l-2 4h12l-2-4\"/><circle cx=\"15\" cy=\"12\" r=\"7\"/><circle cx=\"15\" cy=\"12\" r=\"5\"/><circle cx=\"15\" cy=\"12\" r=\"1\"/><path d=\"M17.00 12.00L20.00 12.00\"/><path d=\"M16.41 13.41L18.54 15.54\"/><path d=\"M15.00 14.00L15.00 17.00\"/><path d=\"M13.59 13.41L11.46 15.54\"/><path d=\"M13.00 12.00L10.00 12.00\"/><path d=\"M13.59 10.59L11.46 8.46\"/><path d=\"M15.00 10.00L15.00 7.00\"/><path d=\"M16.41 10.59L18.54 8.46\"/></svg>"
};
inventoryIcons.chemical="<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M7 3h10v18H7zM7 8h10M7 16h10M10 5h4\"/><path d=\"M3 18h4m10 0h4\"/></svg>";
function renderHome() {
  $('worksheets').innerHTML = catalog.worksheets.map(w => {
    const items = catalog.items.filter(i => i.sourceSheet === w.sourceSheet);
    const places = new Set(items.map(i => i.location)).size;
    const latest = records.filter(record => record.worksheet === w.id && record.status === 'complete').sort((a,b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
    const lastCompleted = latest ? `Last completed: <time datetime="${escapeHtml(latest.date)}">${escapeHtml(prettyDate(latest.date))}</time>` : 'No completed inventory yet';
    return `<button class="worksheet-card" data-worksheet="${w.id}"><span class="worksheet-icon" aria-hidden="true">${inventoryIcons[w.id]}</span><span><strong>${escapeHtml(w.name)}</strong><small>${items.length} supplies · ${places} ${places === 1 ? 'location' : 'locations'}</small><small class="worksheet-last-count">${lastCompleted}</small></span><span class="worksheet-arrow" aria-hidden="true">→</span></button>`;
  }).join('');
  const latestChemical = chemicalRecords?.slice().sort((a,b) => b.date.localeCompare(a.date))[0];
  const chemicalDate = chemicalHistoryUnavailable ? 'Latest reading unavailable' : latestChemical ? `Last saved: <time datetime="${escapeHtml(latestChemical.date)}">${escapeHtml(prettyDate(latestChemical.date))}</time>` : chemicalRecords ? 'No saved readings yet' : 'Loading latest reading...';
  $('worksheets').querySelector('[data-worksheet="operating"]').insertAdjacentHTML('afterend','<a class="worksheet-card chemical-worksheet" href="./chemical-inventory.html"><span class="worksheet-icon" aria-hidden="true">'+inventoryIcons.chemical+'</span><span><strong>Chemical Inventory</strong><small>Tank levels &amp; gallons on hand</small><small class="worksheet-last-count">'+chemicalDate+'</small></span><span class="worksheet-arrow" aria-hidden="true">&rarr;</span></a>');
}
function inventoryOrderStatus(record){
  const chemical=record.worksheet==='chemical',draft=record.status!=='complete';
  const needed=chemical?record.orderSummary?.needed:Number(record.low||0),review=chemical?(record.orderSummary?.review??1):0;
  const noun=chemical?'chemical':'item';
  if(needed>0)return{state:'due',label:(draft?'Draft: ':'')+'Order Needed ('+needed+')',summary:needed+' '+noun+(needed===1?' needs':'s need')+' ordering'+(draft?' (provisional)':'')};
  if(draft)return{state:'draft',label:'Draft Order Report',summary:'Order status is provisional until completed'};
  if(review)return{state:'review',label:'Review Order Status',summary:'Readings or recent usage need review'};
  return{state:'none',label:'No Order Needed',summary:'No '+noun+'s need ordering'};
}
function renderHistory() {
  $('history-title').textContent = mode === 'home' ? 'Recent Inventories' : 'Inventory History';
  $('history-filters').hidden=mode!=='history';
  const selectedType=$('history-type').value;
  $('history-type').innerHTML='<option value="all">All Inventory Types</option>'+(catalog?.worksheets||[]).map(w=>'<option value="'+escapeHtml(w.id)+'">'+escapeHtml(w.name)+'</option>').join('')+'<option value="chemical">Chemical Inventory</option>';
  $('history-type').value=selectedType||'all';
  const all=[...records,...(chemicalRecords||[]).map(record=>({...record,worksheet:'chemical',status:record.status||'complete',updatedAt:record.updatedAt||record.date}))].sort((a,b)=>b.date.localeCompare(a.date)||(b.updatedAt||b.date).localeCompare(a.updatedAt||a.date));
  $('history-list').classList.toggle('recent-inventories',mode==='home');
  const rows = mode === 'home' ? [...all.filter(r=>r.status==='draft'),...all.filter(r=>r.status==='complete')].slice(0,4) : all.filter(r=>$('history-type').value==='all'||r.worksheet===$('history-type').value);
  $('history-list').innerHTML = rows.length ? rows.map(r => {
    const chemical=r.worksheet==='chemical', name=chemical?'Chemical Inventory':worksheetName(r.worksheet), key=chemical?r.date:r.id;
    const orderStatus=inventoryOrderStatus(r);
    const trash='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
    return '<article class="history-card" data-inventory-type="'+escapeHtml(r.worksheet)+'"><div class="history-top"><div class="history-title"><span class="history-inventory-icon" aria-hidden="true">'+(inventoryIcons[r.worksheet]||'')+'</span><strong>'+escapeHtml(name)+'</strong></div><span class="badge '+(r.status==='complete'?'ok':'')+'">'+(r.status==='complete'?'Completed':'Draft')+'</span></div><p>'+escapeHtml(prettyDate(r.date))+' &middot; '+escapeHtml(r.operator)+'</p><div class="history-order-summary">'+escapeHtml(orderStatus.summary)+'</div><div class="history-bottom"><span>'+(chemical?(r.source?'Imported Workbook':r.counted+' of '+r.total+' counted'):r.counted+' of '+r.total+' counted')+'</span><div class="history-controls"><button '+(chemical?'data-chemical-view="'+key+'" data-chemical-resume="'+key+'"':'data-open="'+key+'"')+'>View &rarr;</button><button '+(chemical?'data-chemical-edit':'data-edit')+'="'+key+'">Edit</button><button class="trash-button" '+(chemical?'data-chemical-delete':'data-delete')+'="'+key+'" aria-label="Delete '+escapeHtml(name)+' inventory from '+escapeHtml(prettyDate(r.date))+' by '+escapeHtml(r.operator)+'">'+trash+'</button></div></div>'+'<button class="report-button" data-order-state="'+orderStatus.state+'" '+(chemical?'data-chemical-view="'+key+'"':'data-report="'+r.id+'"')+'>'+escapeHtml(orderStatus.label)+'</button>'+'</article>';
  }).join('') : mode==='history'&&$('history-type').value!=='all'?'<div class="empty">No inventories found for this inventory type.</div>':'<div class="empty">No inventories yet.<br>Choose a worksheet on Home to start your first count.</div>';
}
$('history-type').addEventListener('change',renderHistory);
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
  $('report-note').textContent = (inventory.status === 'complete' ? 'Completed inventory. ' : 'Draft report: ' + remaining + (remaining === 1 ? ' item still uncounted. ' : ' items still uncounted. ')) + 'Items at or below PAR are added to the order list when this inventory is completed. Select what to buy there. Quantities use the worksheet count size.';
  function card(item, manual = false) {
    item = InventoryPackSizes.normalize(item);
    const count = entered(item) ? inventory.counts[item.id] : 'Not counted';
    const detail = [item.company, item.itemNumber && '#' + item.itemNumber, InventoryPackSizes.format(item) && 'Pack: ' + InventoryPackSizes.format(item)].filter(Boolean).join(' | ');
    return '<article class="report-item"><div class="report-item-top">' + productPhoto(item) + '<h3>' + escapeHtml(item.description) + '</h3></div><p class="report-location">' + escapeHtml(item.location) + '</p><div class="report-quantities"><span>On hand <strong>' + escapeHtml(count) + '</strong></span><span>' + (manual ? 'Rule <strong>' + escapeHtml(item.parNote || 'As needed') : 'PAR <strong>' + escapeHtml(item.par)) + '</strong></span></div><p class="report-unit">Count size: <strong>' + escapeHtml(InventoryPackSizes.countSize(item) || 'Not specified') + '</strong></p>' + (detail ? '<p class="report-detail">' + escapeHtml(detail) + '</p>' : '') + (manual ? '<button class="add-to-list" data-add-list="' + escapeHtml(item.id) + '" type="button">Add to List</button>' : '<button class="add-to-list" data-open-order-list type="button">View To Order List</button>') + '</article>';
  }
  $('report-items').innerHTML = needed.length ? needed.map(item => card(item)).join('') : '<div class="empty">No items on the order list.</div>';
  $('report-review').innerHTML = review.length ? '<h2 class="report-review-title">Review as needed</h2><p class="report-note">These items have no numeric PAR. Check whether supplies are needed.</p>' + review.map(item => card(item,true)).join('') : '';
  showMode('report');
  updateListButtons();
  refreshOrderList().catch(error => notify(error.message));
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
    else notifySuccess(message);
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
  const [latest,chemicals] = await Promise.all([api('/api/inventories'),api('/api/chemicals').catch(() => null)]);
  if (request !== historyRequest) return;
  records = latest; chemicalRecords = chemicals?.records; chemicalHistoryUnavailable = !chemicals; renderHistory(); renderHome();
}
function showMode(next) {
  mode = next;
  $('topbar').hidden = next === 'editor';
  $('count-status').hidden = next !== 'editor';
  $('home-view').hidden = next !== 'home'; $('workspace').hidden = next !== 'editor'; $('history-view').hidden = !['home','history'].includes(next);
  $('item-manager').hidden = next !== 'manage';
  $('order-report').hidden = next !== 'report';
  $('order-list-view').hidden = next !== 'order-list';
  $('order-history-view').hidden = next !== 'order-history';
  $('orders-navigation').hidden = !['order-list','order-history'].includes(next);
  $('to-order-tab').setAttribute('aria-pressed', String(next === 'order-list'));
  $('placed-orders-tab').setAttribute('aria-pressed', String(next === 'order-history'));
  $('order-review-view').hidden = next !== 'order-review';
  for (const name of ['home', 'history', 'order-list', 'manage']) { const button = $('nav-' + name); if (next === name || (next === 'report' && name === 'history') || (['order-review','order-history'].includes(next) && name === 'order-list')) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); }
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
  $('footer-copy').textContent = isComplete && editingCompleted ? 'Correcting completed inventory - changes save automatically' : isComplete ? 'Completed and saved · read-only' : invalid.size ? 'Correct the highlighted counts before finishing.' : `${done} of ${items.length} counted · Blank means uncounted.`;
  $('location-select').innerHTML = places.map(name => {
    const group = items.filter(i => i.location === name);
    return `<option value="${escapeHtml(name)}" ${name === locationName ? 'selected' : ''}>${escapeHtml(name)} · ${counted(group)}/${group.length}</option>`;
  }).join('');
  const group = items.filter(i => i.location === locationName);
  $('location-progress').textContent = `${counted(group)} of ${group.length} counted here`;
}
function productPhoto(item) {
  if (!SHOW_PRODUCT_IMAGES) return '';
  const photo = InventoryProductImages.find(item,catalog.images);
  if (!photo) return '';
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
    return `<article class="item-card"><div class="item-body"><div class="item-top">${productPhoto(i)}<h2 class="item-name">${escapeHtml(i.description)}</h2><span class="badge ${cls}" data-status="${i.id}">${label}</span></div></div><div class="count-row"><label for="count-${i.id}">How many on hand?<span class="unit-value">${escapeHtml(InventoryPackSizes.countSize(i) || "Count size unspecified")}</span>${packSize ? `<span class="unit-pack-size">${escapeHtml(packSize)}</span>` : ""}</label><div class="quantity-control"><input id="count-${i.id}" class="count-input ${invalid.has(i.id) ? "invalid" : ""}" ${invalid.has(i.id) ? 'aria-invalid="true"' : ""} data-id="${i.id}" aria-label="On hand: ${escapeHtml(i.description)}, ${escapeHtml(InventoryPackSizes.countSize(i) || "count size unspecified")}" type="number" min="0" max="1000000000" step="any" inputmode="decimal" enterkeyhint="next" placeholder="—" value="${escapeHtml(value)}" ${(run.status === "complete" && !editingCompleted) || conflict || completing || navigating ? "disabled" : ""}></div></div><div class="item-reference"><div class="previous-count" data-previous="${i.id}">Previous: <strong>${escapeHtml(run.previousCounts?.[i.id] ?? "No record")}</strong></div><div class="par-value">PAR: <strong>${escapeHtml(i.par ?? i.parNote)}</strong></div></div></article>`;
  }).join('') : '<div class="empty">No items in this location.</div>';
}
function render() { renderOverview(); renderItems(); }
async function flush(complete = false) {
  clearTimeout(timer);
  if (reviewingCount) throw new Error('Confirm or edit the highlighted count first.');
  if (saving) { while (saving) await new Promise(resolve => setTimeout(resolve, 40)); }
  if (conflict) throw new Error('This draft changed elsewhere. Your unsaved values remain visible. Reload to get the latest version.');
  if (invalid.size) throw new Error('Correct the highlighted counts before continuing.');
  if (!run || (run.status === 'complete' && !editingCompleted) || (!Object.keys(pending).length && !complete)) return;
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
    run = await api(`/api/inventories/${run.id}`, { method:'PATCH', body:JSON.stringify({ revision:run.revision, counts:changes, ...(editingCompleted ? {editCompleted:true}:{}), ...(complete ? { status:'complete' } : {}) }) });
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
  try { await flush(); if(next==='trends'){location.assign('./trends.html');return;} if (['order-list','order-history'].includes(next)) await refreshOrderList(); showMode(next); history().catch(error => notify(error.message)); }
  catch (error) { if (!Object.keys(pending).length) notify(error.message); }
  finally { navigating = false; render(); }
}
// The shared app switcher waits for the same save path as in-app navigation.
document.addEventListener('operations:before-navigate', event => {
  event.detail.waitUntil((async () => {
    if(navigating || completing || listBusy || itemBusy || sendingReport || deleting)return false;
    navigating=true;render();
    try { await flush(); return true; }
    catch(error){ notify(error.message); return false; }
    finally { navigating=false;render(); }
  })());
});
function selectLocation(name) { locationName = name; render(); }
$('back-home').addEventListener('click', () => navigate('home'));
$('nav-trends').addEventListener('click', () => navigate('trends'));
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
  return field?.matches('input:not([disabled]):not([readonly]):not([type=button]):not([type=submit]), textarea:not([readonly])') ? field : null;
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
  const keyboardOpen = Boolean(document.documentElement.dataset.layout === 'mobile' && field && atNormalScale && fullViewportHeight - height > 120);
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
  const button = event.target.closest('[data-worksheet],.chemical-worksheet'); if (!button) return;
  event.preventDefault(); if (navigating) return;
  try {
    await flush(); catalog = await api('/api/catalog'); await history(); renderHome(); selectedWorksheet = button.classList.contains('chemical-worksheet')?'chemical':button.dataset.worksheet;
    if(selectedWorksheet==='chemical'){
      const chemicals=await api('/api/chemicals'),unfinished=chemicals.records.find(record=>record.status==='draft');
      if(unfinished){window.location.assign('./chemical-inventory.html?date='+encodeURIComponent(unfinished.date));return;}
    }
    const unfinished=records.find(record=>record.worksheet===selectedWorksheet&&record.status==='draft');
    if(unfinished){run=await api('/api/inventories/'+unfinished.id);resetEdits();locationName=run.items.find(item=>run.counts[item.id]===undefined)?.location||run.items[0].location;$('save-status').textContent='All changes saved';notifySuccess('Resumed your unfinished inventory.');showMode('editor');return;}
    const worksheet = catalog.worksheets.find(w => w.id === selectedWorksheet), items = worksheet?catalog.items.filter(i => i.sourceSheet === worksheet.sourceSheet):[];
    $('new-worksheet-title').textContent = selectedWorksheet==='chemical'?'Chemical Inventory':worksheet.name; $('new-worksheet-copy').textContent = selectedWorksheet==='chemical'?'Choose a date and enter your name to begin recording chemical readings.':`${items.length} supplies to count. Choose a date and enter your name to begin.`;
    const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    $('inventory-date').value = date.toISOString().slice(0,10); $('operator-name').value = run?.operator || ''; $('form-error').textContent = ''; $('new-dialog').showModal();
  } catch (error) { notify(error.message); }
});
$('cancel-new').addEventListener('click', () => $('new-dialog').close());
$('new-form').addEventListener('submit', async event => {
  if(!$('operator-name').value.trim()){event.preventDefault();$('form-error').textContent='Choose your name from the operator list.';$('operator-name').focus();return;}
  event.preventDefault(); if (navigating) return; navigating = true; $('start-count').disabled = true;
  try {
    await flush();
    if(selectedWorksheet==='chemical'){
      const chemicals=await api('/api/chemicals'),unfinished=chemicals.records.find(record=>record.status==='draft');
      const date=unfinished?.date||$('inventory-date').value;
      if(!unfinished){
        if(chemicals.records.some(record=>record.date===date))throw new Error('A chemical inventory already exists for this date. Choose a different date, or open the saved inventory from History.');
        await api('/api/chemicals/records/'+encodeURIComponent(date),{method:'PUT',body:JSON.stringify({revision:chemicals.revision,operator:$('operator-name').value,readings:{},notes:'',status:'draft'})});
      }
      window.location.assign('./chemical-inventory.html?date='+encodeURIComponent(date));return;
    }
    run = await api('/api/inventories', { method:'POST', body:JSON.stringify({ worksheet:selectedWorksheet, date:$('inventory-date').value, operator:$('operator-name').value }) });
    resetEdits(); locationName = run.items.find(item=>run.counts[item.id]===undefined)?.location||run.items[0].location; $('new-dialog').close(); $('save-status').textContent = run.resumed?'Draft resumed':'Draft saved'; notify(); showMode('editor'); if(run.resumed)notifySuccess('Resumed the existing unfinished inventory.');history().catch(error => notify(error.message));
  } catch (error) { $('form-error').textContent = error.message; }
  finally { navigating = false; $('start-count').disabled = false; render(); }
});
$('history-list').addEventListener('click', async event => {
  const trash = event.target.closest('[data-delete],[data-chemical-delete]');
  if (!trash || navigating || deleting) return;
  navigating = true; trash.disabled = true;
  try {
    await flush();
    if(trash.dataset.chemicalDelete){const chemicals=await api('/api/chemicals');deleteTarget={...chemicals.records.find(record=>record.date===trash.dataset.chemicalDelete),worksheet:'chemical',revision:chemicals.revision};}else deleteTarget = await api('/api/inventories/' + trash.dataset.delete);
    $('delete-copy').textContent = (deleteTarget.worksheet==='chemical'?'Chemical Inventory':worksheetName(deleteTarget.worksheet)) + ' | ' + prettyDate(deleteTarget.date) + ' | ' + deleteTarget.operator + ' (' + (deleteTarget.status === 'complete' ? 'Completed' : 'Draft') + ')';
    $('delete-error').textContent = ''; $('delete-dialog').showModal();
  } catch (error) { notify(error.message); }
  finally { navigating = false; trash.disabled = false; }
});
$('history-list').addEventListener('click', async event => {
  const button=event.target.closest('[data-chemical-view],[data-chemical-edit]');if(!button||navigating)return;
  navigating=true;
  try{await flush();window.location.assign('./chemical-inventory.html?date='+encodeURIComponent(button.dataset.chemicalView||button.dataset.chemicalEdit)+'&view='+(button.dataset.chemicalEdit?'edit':'report'));}
  catch(error){notify(error.message);navigating=false;}
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
    if(deleteTarget.worksheet==='chemical'){await api('/api/chemicals/records/'+deleteTarget.date,{method:'DELETE',body:JSON.stringify({revision:deleteTarget.revision})});++historyRequest;$('delete-dialog').close();await history();notifySuccess('Inventory deleted.');return;}
    await api('/api/inventories/' + id, { method:'DELETE', body:JSON.stringify({ revision:deleteTarget.revision }) });
    if (run?.id === id) { run = null; resetEdits(); }
    ++historyRequest; // Ignore refreshes that started before this deletion.
    records = records.filter(r => r.id !== id); renderHistory();
    $('delete-dialog').close(); notifySuccess('Inventory deleted.');
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
  const button = event.target.closest('[data-open],[data-edit]'); if (!button || navigating) return;
  navigating = true; button.disabled = true;
  try { await flush(); run = await api('/api/inventories/' + (button.dataset.open||button.dataset.edit)); editingCompleted=!!button.dataset.edit; resetEdits(); locationName = run.items.find(i => run.counts[i.id] === undefined)?.location || run.items[0].location; $('save-status').textContent = run.status === 'complete' && !editingCompleted ? 'Saved · read-only' : 'All changes saved'; notify(); showMode('editor'); }
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
window.addEventListener('pageshow', event => { if (event.persisted) history().catch(error => notify(error.message)); });
window.addEventListener('beforeunload', event => { if (saving || Object.keys(pending).length || invalid.size) { event.preventDefault(); event.returnValue = ''; } });
async function init() {
  try { [catalog,emailConfig,orderList] = await Promise.all([api('/api/catalog'),api('/api/email-config'),api('/api/order-list')]); renderOrderList(); renderHome(); const requestedView=new URLSearchParams(location.search).get('view'); showMode(['home','history','order-list','order-history','manage'].includes(requestedView)?requestedView:'home'); if(mode==='manage')await openManager(); await history(); }
  catch (error) { notify('Could not load inventory: ' + error.message); }
}
init();

// Catalog management uses revisions so one phone cannot overwrite another's edits.
let editingItem = null, removingItem = null, itemRevision = 0, itemBusy = false;
const itemFields = ['description','countSize','parNote','company','itemNumber','caseSize','productUrl'];
const selectedBinCards = new Set();
function openBinCardPreview(ids) {
  const allowed = new Set(InventoryBinCards.items(catalog).map(i => i.id));
  const selected = ids.filter(id => allowed.has(id));
  if (!selected.length) return;
  const query = new URLSearchParams();
  selected.forEach(id => query.append('id',id));
  window.open('./bin-cards.html?' + query.toString(),'_blank','noopener,noreferrer');
}
function updateBinCardSelection() {
  const items = InventoryBinCards.items(catalog);
  const allowed = new Set(items.map(i => i.id));
  for (const id of selectedBinCards) if (!allowed.has(id)) selectedBinCards.delete(id);
  $('bin-card-selection').textContent = selectedBinCards.size + ' of ' + items.length + ' items selected';
  $('print-selected-bin-cards').disabled = !selectedBinCards.size;
  $('clear-bin-cards').disabled = !selectedBinCards.size;
  $('select-all-bin-cards').disabled = !items.length || selectedBinCards.size === items.length;
}
function renderBinCardPicker() {
  updateBinCardSelection();
  const search = $('bin-card-search').value.trim().toLowerCase();
  const items = InventoryBinCards.items(catalog).filter(i => [i.description,i.company,i.itemNumber].some(value => String(value || '').toLowerCase().includes(search)));
  $('bin-card-list').innerHTML = items.length ? items.map(item => {
    const issues = InventoryBinCards.details(item,catalog.images).issues;
    return '<label class="bin-card-choice"><input type="checkbox" data-bin-card="' + escapeHtml(item.id) + '"' + (selectedBinCards.has(item.id) ? ' checked' : '') + '><span><strong>' + escapeHtml(item.description) + '</strong><small>' + escapeHtml([item.company,item.itemNumber].filter(Boolean).join(' · ')) + '</small>' + (issues.length ? '<small class="bin-card-warning">' + escapeHtml(issues.join(' · ')) + '</small>' : '') + '</span></label>';
  }).join('') : '<div class="empty">No matching Operating Supplies items.</div>';
}
function managementSection(section) {
  $('manage-items-panel').hidden = section !== 'items';
  $('bin-cards-panel').hidden = section !== 'cards';
  $('chemical-settings-panel').hidden = section !== 'chemicals';
  $('manage-items-tab').setAttribute('aria-pressed',String(section === 'items'));
  $('print-bin-cards-tab').setAttribute('aria-pressed',String(section === 'cards'));
  $('chemical-settings-tab').setAttribute('aria-pressed',String(section === 'chemicals'));
  if (section === 'cards') renderBinCardPicker();
  if (section === 'chemicals') window.ChemicalSettingsManager.open();
}
function renderManager() {
  const worksheet = catalog.worksheets.find(w => w.id === $('manager-worksheet').value);
  const all=catalog.items.filter(item=>item.sourceSheet===worksheet?.sourceSheet),location=$('manager-location').value;
  $('manager-location').innerHTML='<option value="">All Locations</option>'+[...new Set(all.map(item=>item.location))].map(name=>'<option value="'+escapeHtml(name)+'">'+escapeHtml(name)+'</option>').join('');
  $('manager-location').value=all.some(item=>item.location===location)?location:'';
  const query=$('manager-search').value.trim().toLowerCase(),items=all.filter(item=>(!$('manager-location').value||item.location===$('manager-location').value)&&(!query||[item.description,item.company,item.itemNumber].some(value=>String(value||'').toLowerCase().includes(query))));
  $('manager-result-count').textContent=items.length+' of '+all.length+' items';
  $('manager-list').innerHTML = items.length ? items.map(item => '<article class="manager-card"><h2>' + escapeHtml(item.description) + '</h2><p>' + escapeHtml(item.location) + ' &middot; ' + escapeHtml(item.countSize) + ' &middot; PAR: ' + escapeHtml(item.par === null ? 'As needed' : item.par) + '</p><div class="manager-actions"><button type="button" data-edit-item="' + item.id + '">Edit</button>' + (worksheet.id === 'operating' ? '<button type="button" data-print-bin-card="' + escapeHtml(item.id) + '">Print card</button>' : '') + '<button type="button" data-remove-item="' + item.id + '">Remove</button></div></article>').join('') : '<div class="empty">No matching supply items. Adjust the search or location, or add an item.</div>';
  renderBinCardPicker();
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
  if (navigating || completing) return;
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
$('nav-manage').addEventListener('click',openManager);
$('manage-items-tab').addEventListener('click',() => managementSection('items'));
$('print-bin-cards-tab').addEventListener('click',() => managementSection('cards'));
$('chemical-settings-tab').addEventListener('click',()=>managementSection('chemicals'));
$('manager-search').addEventListener('input',renderManager);
$('manager-location').addEventListener('change',renderManager);
$('bin-card-search').addEventListener('input',renderBinCardPicker);
$('bin-card-list').addEventListener('change',event => {
  const checkbox = event.target.closest('[data-bin-card]');
  if (!checkbox) return;
  if (checkbox.checked) selectedBinCards.add(checkbox.dataset.binCard); else selectedBinCards.delete(checkbox.dataset.binCard);
  updateBinCardSelection();
});
$('select-all-bin-cards').addEventListener('click',() => { InventoryBinCards.items(catalog).forEach(i => selectedBinCards.add(i.id)); renderBinCardPicker(); });
$('clear-bin-cards').addEventListener('click',() => { selectedBinCards.clear(); renderBinCardPicker(); });
$('print-selected-bin-cards').addEventListener('click',() => openBinCardPreview([...selectedBinCards]));
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
    $('manager-worksheet').value = body.worksheet; renderManager(); renderHome(); $('item-dialog').close(); notifySuccess('Item saved. Changes apply to new inventories.');
  } catch (error) { $('item-error').textContent = error.message; }
  finally { itemBusy = false; $('save-item').disabled = false; }
});
$('manager-list').addEventListener('click',event => {
  const print = event.target.closest('[data-print-bin-card]');
  if (print) { openBinCardPreview([print.dataset.printBinCard]); return; }
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
    renderManager(); renderHome(); $('remove-item-dialog').close(); notifySuccess('Item removed from new inventories.');
  } catch (error) { $('remove-item-error').textContent = error.message; }
  finally { itemBusy = false; $('confirm-remove-item').disabled = false; }
});
for (const id of ['item-dialog','remove-item-dialog']) $(id).addEventListener('cancel',event => { if (itemBusy) event.preventDefault(); });

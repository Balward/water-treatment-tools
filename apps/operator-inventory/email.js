'use strict';
const fs = require('node:fs');
const path = require('node:path');
const imageManifest = require('./public/images/manifest.json');
const packSizes = require('./public/pack-sizes');
const validAddress = value => typeof value === 'string' && value.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function buildReportEmail(inventory, worksheetName) {
  inventory = {...inventory,items:inventory.items.map(packSizes.normalize)};
  function productLink(item) {
    if (typeof item.productUrl !== 'string') return '';
    try {
      const url = new URL(item.productUrl);
      return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  const attachments = [];
  const photos = new Map();
  function itemPhoto(item) {
    if (photos.has(item.id)) return photos.get(item.id);
    const photo = imageManifest.items[item.id];
    let html = '';
    if (photo && ['workbook-link','user-provided'].includes(photo.sourceType) && packSizes.normalize({...photo,id:item.id}).description === item.description && (photo.itemNumber === item.itemNumber || photo.allowedItemNumbers?.includes(item.itemNumber)) && /^\/images\/s[123]-r\d+\.(jpg|png|webp|gif)$/.test(photo.src)) {
      try {
        const content = fs.readFileSync(path.join(__dirname,'public',photo.src.slice(1)));
        const ext = path.extname(photo.src).slice(1);
        const cid = `inventory-${item.id}@operator-inventory`;
        attachments.push({filename:path.basename(photo.src),content,contentType:{jpg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}[ext],cid,contentDisposition:'inline'});
        html = `<br><img src="cid:${cid}" alt="${escapeHtml(item.description)}" width="72" height="72" style="display:block;width:72px;height:72px;object-fit:contain;margin-top:8px;border:0;">`;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    photos.set(item.id,html);
    return html;
  }
  const entered = item => typeof inventory.counts[item.id] === 'number';
  const needed = inventory.items.filter(item => entered(item) && typeof item.par === 'number' && inventory.counts[item.id] <= item.par);
  const review = inventory.items.filter(item => item.par === null);
  const missing = inventory.items.filter(item => !entered(item)).length;
  const title = `${inventory.status === 'complete' ? '' : 'DRAFT - '}Order Needed: ${worksheetName} - ${inventory.date}`;
  const note = inventory.status === 'complete' ? 'Completed inventory.' : `Draft report: ${missing} ${missing === 1 ? 'item remains' : 'items remain'} uncounted. Blank counts are excluded from the order list.`;
  const header = `${worksheetName} | ${inventory.date} | ${inventory.operator}`;
  const line = (item, manual) => `${item.description}\nLocation: ${item.location}\nOn hand: ${entered(item) ? inventory.counts[item.id] : 'Not counted'} | ${manual ? 'Rule: ' + (item.parNote || 'As needed') : 'PAR: ' + item.par}\nCount size: ${item.countSize || 'Not specified'}\n${[item.company && 'Supplier: ' + item.company, item.itemNumber && 'Product #: ' + item.itemNumber, item.caseSize && 'Pack: ' + item.caseSize].filter(Boolean).join(' | ')}`;
  const text = [title,header,note,`${needed.length} items at or below PAR.`,needed.length ? needed.map(item => line(item,false)).join('\n\n') : 'No counted items need ordering.',review.length ? 'REVIEW AS NEEDED\nThese items have no numeric PAR.\n\n' + review.map(item => line(item,true)).join('\n\n') : '', 'This is an inventory report. No orders have been placed.'].filter(Boolean).join('\n\n');
  // Inline styles keep the report readable in email clients that strip stylesheets.
  const cellStyle = 'padding:10px 6px;border:1px solid #ccd9ce;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-wrap:break-word;';
  function table(items, manual = false) {
    const columns = [['Item','25%'],['Location','18%'],['On hand','10%'],[manual ? 'Rule' : 'PAR','9%'],['Count size','16%'],['Supplier / product','22%']];
    const headings = columns.map(([name,width]) => `<th scope="col" width="${width}" style="${cellStyle}background:#174e42;color:#ffffff;font-weight:bold;">${name}</th>`).join('');
    const rows = items.map((item,index) => {
      const link = productLink(item);
      const productNumber = item.itemNumber ? 'Product #: ' + (link ? `<a href="${escapeHtml(link)}" style="color:#174e42;text-decoration:underline;">${escapeHtml(item.itemNumber)}</a>` : escapeHtml(item.itemNumber)) : '';
      const supplier = [escapeHtml(item.company), productNumber, item.caseSize && escapeHtml('Pack: ' + item.caseSize)].filter(Boolean).join('<br>') || '-';
      const values = [escapeHtml(item.description) + itemPhoto(item),escapeHtml(item.location || '-'),escapeHtml(entered(item) ? inventory.counts[item.id] : 'Not counted'),escapeHtml(manual ? item.parNote || 'As needed' : item.par),escapeHtml(item.countSize || 'Not specified'),supplier];
      return `<tr style="background:${index % 2 ? '#f0f5ed' : '#ffffff'};">${values.map((value,column) => column === 0 ? `<th scope="row" style="${cellStyle}font-weight:bold;">${value}</th>` : `<td style="${cellStyle}${column === 2 || (!manual && column === 3) ? 'font-weight:bold;text-align:center;' : ''}">${value}</td>`).join('')}</tr>`;
    }).join('');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;line-height:1.5;margin:16px 0 24px;"><thead><tr>${headings}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;padding:16px;background:#f6f7f1;color:#243c33;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:880px;margin:0 auto;"><h1 style="font-size:24px;color:#174e42;line-height:1.3;">${escapeHtml(title)}</h1><p>${escapeHtml(header)}</p><p style="font-size:13px;line-height:1.6;">${escapeHtml(note)}</p><h2 style="font-size:18px;">${needed.length} items at or below PAR</h2>${needed.length ? table(needed) : '<p>No counted items need ordering.</p>'}${review.length ? '<h2 style="font-size:18px;">Review as needed</h2><p style="font-size:13px;">These items have no numeric PAR.</p>' + table(review,true) : ''}<p style="font-size:12px;color:#46594b;">This is an inventory report. No orders have been placed.</p></div></body></html>`;
  return { subject:title.replace(/[\r\n]/g,' '), text, html, attachments };
}
function createMailer(env = process.env, createTransport) {
  const user = env.SMTP_USER?.trim() || '';
  const port = Number(env.SMTP_PORT || 465);
  const enabled = validAddress(user) && Boolean(env.SMTP_PASSWORD) && [465,587].includes(port);
  const defaultTo = validAddress(env.EMAIL_DEFAULT_TO?.trim()) ? env.EMAIL_DEFAULT_TO.trim() : '';
  if (!enabled) return { enabled:false, defaultTo };
  const transport = (createTransport || require('nodemailer').createTransport)({
    host:env.SMTP_HOST || 'mail.privateemail.com', port, secure:port === 465, requireTLS:port === 587,
    auth:{user,pass:env.SMTP_PASSWORD}, tls:{minVersion:'TLSv1.2'},
    connectionTimeout:15000, greetingTimeout:15000, socketTimeout:30000,
    disableFileAccess:true, disableUrlAccess:true
  });
  return {
    enabled:true, defaultTo,
    async send(to, report) {
      const info = await transport.sendMail({ from:{name:'Operator Inventory',address:user}, to:{address:to}, ...report });
      if (!info.accepted?.length || info.rejected?.length) throw new Error('Recipient not accepted');
    }
  };
}
module.exports = { validAddress, buildReportEmail, createMailer };

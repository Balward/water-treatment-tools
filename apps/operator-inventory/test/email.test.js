const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../server');
const { buildReportEmail, createMailer, validAddress } = require('../email');

test('email report preserves units and separates numeric PAR from manual and blank counts', () => {
  const report = buildReportEmail({date:'2026-10-10',operator:'<Blain>',status:'draft',counts:{zero:0,equal:0.5,above:3,manual:0},items:[
    {id:'zero',description:'Empty item',location:'Shelf',countSize:'Case of 10',par:1,company:'Supplier',itemNumber:'123'},
    {id:'equal',description:'Threshold item',location:'Shelf',countSize:'Case',par:0.5},
    {id:'above',description:'Enough stock',par:2},
    {id:'blank',description:'Uncounted item',par:1},
    {id:'manual',description:'Rags',location:'Shelf',countSize:'Bag',par:null,parNote:'Fill As Needed'}
  ]},'Operating Supplies');
  assert.match(report.subject,/DRAFT - Order Needed/);
  assert.match(report.text,/2 items at or below PAR/);
  assert.match(report.text,/Count size: Case of 10/);
  assert.match(report.text,/Product #: 123/);
  assert.match(report.text,/Threshold item/);
  assert.doesNotMatch(report.text,/Enough stock|Uncounted item/);
  assert.match(report.text,/1 item remains uncounted/);
  assert.match(report.text,/REVIEW AS NEEDED/);
  assert.match(report.html,/&lt;Blain&gt;/);
  assert.doesNotMatch(report.html,/<Blain>/);
  assert.equal((report.html.match(/<table /g) || []).length,2,'Ordering and manual review have separate tables');
  for (const column of ['Item','Location','On hand','PAR','Count size','Supplier / product','Rule']) assert.ok(report.html.includes('>'+column+'</th>'));
  assert.match(report.html,/Product #: 123/);
  assert.match(report.html,/Case of 10/);
  assert.doesNotMatch(report.html,/Enough stock|Uncounted item/);
  const empty = buildReportEmail({date:'2026-10-10',operator:'Blain',status:'complete',counts:{a:2},items:[{id:'a',description:'Stocked',par:1}]},'Supplies');
  assert.doesNotMatch(empty.html,/<table/);
  assert.match(empty.html,/No counted items need ordering/);
  assert.equal(validAddress('staff@gibbhub.io'),true);
  for (const bad of ['a@example.com,b@example.com','a@example.com\r\nBcc: b@example.com','<a@example.com>','missing','']) assert.equal(validAddress(bad),false);
});

test('email embeds approved photos only for report rows matching the saved item', () => {
  const catalog = require('../catalog.json');
  const item = id => ({...catalog.items.find(item => item.id === id)});
  const report = buildReportEmail({date:'2026-10-10',operator:'Blain',status:'complete',counts:{'s1-r5':0,'s1-r6':0,'s1-r7':99,'s1-r8':0,'s3-r14':0},items:[
    item('s1-r5'),item('s1-r6'),item('s1-r7'),item('s1-r9'),{...item('s1-r8'),itemNumber:'different-product'},item('s3-r14')
  ]},'Supplies');
  assert.deepEqual(report.attachments.map(photo => photo.filename),['s1-r5.jpg','s1-r6.jpg']);
  for (const attachment of report.attachments) {
    assert.ok(Buffer.isBuffer(attachment.content) && attachment.content.length > 500);
    assert.equal(attachment.contentDisposition,'inline');
    assert.equal(attachment.contentType,'image/jpeg');
    assert.ok(report.html.includes(`src="cid:${attachment.cid}"`));
  }
  assert.equal((report.html.match(/<img /g) || []).length,2);
  assert.doesNotMatch(report.html,/src="https?:|src="\/images\//);
});

test('product numbers link to saved HTTP product pages with escaped URLs and labels', () => {
  const items = [
    {id:'linked',description:'Linked item',itemNumber:'123<&',productUrl:'https://supplier.example/product?id=123&pack=case',par:1},
    {id:'plain',description:'No link',itemNumber:'456',par:1},
    {id:'unsafe',description:'Invalid link',itemNumber:'789',productUrl:'javascript:alert(1)',par:1},
    {id:'manual',description:'Review item',itemNumber:'999',productUrl:'https://supplier.example/manual',par:null}
  ];
  const report = buildReportEmail({date:'2026-10-10',operator:'Blain',status:'complete',counts:{linked:0,plain:0,unsafe:0},items},'Supplies');
  assert.match(report.html,/href="https:\/\/supplier.example\/product\?id=123&amp;pack=case"[^>]*>123&lt;&amp;<\/a>/);
  assert.match(report.html,/Product #: 456/);
  assert.match(report.html,/Product #: 789/);
  assert.doesNotMatch(report.html,/javascript:/);
  assert.match(report.html,/href="https:\/\/supplier.example\/manual"[^>]*>999<\/a>/);
});

test('SMTP settings use authenticated TLS, with no browser credentials', async () => {
  assert.equal(createMailer({}).enabled,false);
  let options, message;
  const mailer = createMailer({SMTP_USER:'inventory@gibbhub.io',SMTP_PASSWORD:'test-only-secret',EMAIL_DEFAULT_TO:'staff@gibbhub.io'},config => {
    options = config;
    return {sendMail:async value => { message = value; return {accepted:['staff@gibbhub.io'],rejected:[]}; }};
  });
  assert.equal(options.host,'mail.privateemail.com'); assert.equal(options.port,465); assert.equal(options.secure,true);
  assert.equal(options.disableFileAccess,true); assert.equal(options.disableUrlAccess,true);
  await mailer.send('staff@gibbhub.io',{subject:'Report',text:'Saved report'});
  assert.equal(message.from.address,'inventory@gibbhub.io');
  assert.equal(message.to.address,'staff@gibbhub.io');
  createMailer({SMTP_USER:'inventory@gibbhub.io',SMTP_PASSWORD:'test-only-secret',SMTP_PORT:'587'},config => {
    assert.equal(config.secure,false); assert.equal(config.requireTLS,true); return {};
  });
});

test('embedded photos are packaged as related MIME attachments without external fetches', async () => {
  const item = require('../catalog.json').items.find(item => item.id === 's1-r5');
  const report = buildReportEmail({date:'2026-10-10',operator:'Blain',status:'complete',counts:{[item.id]:0},items:[item]},'Operating Supplies');
  const transport = require('nodemailer').createTransport({streamTransport:true,buffer:true,disableFileAccess:true,disableUrlAccess:true});
  const result = await transport.sendMail({from:'inventory@example.com',to:'staff@example.com',...report});
  const mime = result.message.toString();
  assert.match(mime,/Content-Type: multipart\/related/);
  assert.match(mime,/Content-ID: <inventory-s1-r5@operator-inventory>/);
  assert.match(mime,/Content-Type: image\/jpeg/);
  assert.match(mime,/Content-Disposition: inline/);
});

test('email endpoint uses saved revisions, rejects invalid sends, reports SMTP failures and limits duplicates', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(),'inventory-email-'));
  let failSend = true, calls = 0, sent;
  const server = createApp({dataDir,mailer:{enabled:true,defaultTo:'staff@gibbhub.io',send:async (to,report)=>{
    calls++; if (failSend) throw Object.assign(new Error('test-only-secret'),{code:'EAUTH'}); sent = {to,report};
  }}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});});
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route,body,origin=base) {
    const response = await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(origin ? {Origin:origin} : {})},...(body ? {body:JSON.stringify(body)} : {})});
    return {status:response.status,data:await response.json()};
  }
  const config = await request('/api/email-config');
  assert.deepEqual(config.data,{enabled:true,defaultTo:'staff@gibbhub.io'});
  const run = (await request('/api/inventories',{worksheet:'operating',operator:'Email test',date:'2026-10-10'})).data;
  const route = `/api/inventories/${run.id}/email`;
  assert.equal((await request(route,{to:'staff@gibbhub.io',revision:0},'https://another.example')).status,403);
  assert.equal((await request(route,{to:'staff@gibbhub.io',revision:0},null)).status,403);
  assert.equal((await request(route,{to:'bad',revision:0})).status,400);
  assert.equal((await request(route,{to:'staff@gibbhub.io',revision:99})).status,409);
  const failure = await request(route,{to:'staff@gibbhub.io',revision:0});
  assert.equal(failure.status,502); assert.doesNotMatch(JSON.stringify(failure.data),/test-only-secret/);
  assert.equal(calls,1);
  failSend = false;
  // The failed-send cooldown is intentional; wait for its five-second retry window.
  await new Promise(resolve=>setTimeout(resolve,5100));
  const success = await request(route,{to:'staff@gibbhub.io',revision:0});
  assert.equal(success.status,200); assert.equal(sent.to,'staff@gibbhub.io');
  assert.match(sent.report.text,/40 items remain uncounted/);
  assert.match(sent.report.text,/No counted items need ordering/);
  assert.equal((await request(route,{to:'staff@gibbhub.io',revision:0})).status,429);
  assert.equal(calls,2);
  assert.equal((await fetch(base+'/email.js')).status,404);
});

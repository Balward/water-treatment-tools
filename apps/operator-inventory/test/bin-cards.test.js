'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const cards = require('../public/bin-cards');
const {createApp} = require('../server');
const seed = require('../catalog.json');
const images = require('../public/images/manifest.json').items;
const worksheets = [{id:'operating',sourceSheet:1},{id:'janitorial',sourceSheet:2},{id:'dewatering',sourceSheet:3}];

test('cards include only current Operating Supplies items and retain normalized units',() => {
  const items = cards.items({...seed,worksheets});
  assert.equal(items.length,40);
  assert.ok(items.every(i => i.sourceSheet === 1));
  const buffer = items.find(i => i.id === 's1-r7');
  const html = cards.card(buffer,images);
  assert.match(html,/1 Box/);
  assert.match(html,/20 singlets \/ box · 20 mL each/);
  assert.doesNotMatch(html,/Count size|Under Stairwell|Add to order list/);
  assert.ok(cards.details(buffer,images).qr.startsWith('data:image/svg+xml;base64,'));
  assert.deepEqual(cards.items({...seed,worksheets:[]}),[]);
  assert.equal(cards.items({items:seed.items.filter(i => i.id !== buffer.id),worksheets}).length,39);
});

test('missing and stale item metadata is explicit, with no fabricated QR or photo',() => {
  const buffer = cards.items({...seed,worksheets}).find(i => i.id === 's1-r7');
  const edited = {...buffer,description:'New product',itemNumber:'New number',productUrl:'',company:'',caseSize:''};
  const info = cards.details(edited,images);
  assert.equal(info.image,'');
  assert.equal(info.qr,'');
  assert.ok(info.issues.includes('Photo unavailable'));
  assert.ok(info.issues.includes('No product link'));
  assert.match(cards.card(edited,images),/No product link/);
  const manual = cards.card({...edited,par:null,parNote:'Fill As Needed',itemNumber:null},images);
  assert.match(manual,/Fill As Needed/);
  assert.match(manual,/No product number/);
  assert.doesNotMatch(manual,/null|undefined/);
});

test('user-entered card fields are escaped and unsafe product URLs cannot become links',() => {
  const item = {...seed.items[0],description:'<img src=x onerror=alert(1)>',company:'<script>bad()</script>',itemNumber:'" onclick="bad()',productUrl:'javascript:alert(1)',caseSize:'<b>pack</b>'};
  const html = cards.card(item,images);
  assert.match(html,/&lt;img/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>|href="javascript:| onclick="/);
  assert.equal(cards.productUrl({...item,productUrl:'https://user:password@example.com/a'}),'');
  assert.equal(cards.productUrl({...item,productUrl:'https://www.amazon.com/gp/product/B07VBZ9384?ref=test'}),'https://www.amazon.com/dp/B07VBZ9384');
});

test('printing assets are served locally and a catalog edit changes newly rendered cards',async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(),'inventory-bin-cards-'));
  const server = createApp({dataDir,mailer:{enabled:false}});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async() => { await new Promise(resolve => server.close(resolve)); fs.rmSync(dataDir,{recursive:true,force:true}); });
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const asset of ['bin-cards.html','bin-cards.css','bin-cards.js','bin-card-print.js','vendor/qrcode.js']) {
    const response = await fetch(base + '/' + asset);
    assert.equal(response.status,200,asset);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  }
  assert.equal((await fetch(base + '/vendor/not-a-file.js')).status,404);
  const catalog = await (await fetch(base + '/api/catalog')).json();
  const item = cards.items(catalog)[0];
  const response = await fetch(base + '/api/catalog/items/' + item.id,{method:'PATCH',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...item,worksheet:'operating',revision:catalog.revision,description:'Current print name',company:'New vendor',itemNumber:'XYZ-123',par:2})});
  assert.equal(response.status,200);
  const latest = await (await fetch(base + '/api/catalog')).json();
  const html = cards.card(cards.items(latest)[0],latest.images);
  assert.match(html,/Current print name/); assert.match(html,/New vendor/); assert.match(html,/#XYZ-123/); assert.match(html,/2 Bottle/);
  assert.deepEqual(await (await fetch(base + '/api/inventories')).json(),[],'Previewing cards never creates an inventory');
});

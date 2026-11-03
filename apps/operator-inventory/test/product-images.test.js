'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const productImages = require('../public/product-images');
const cards = require('../public/bin-cards');
const {buildReportEmail} = require('../email');
const catalog = require('../catalog.json');
const images = require('../public/images/manifest.json').items;
const renamed = {
  's1-r25':'Swiftest Free Chlorine Reagent Refill Vial',
  's1-r26':'Swiftest Total Chlorine Reagent Refill Vial',
  's1-r33':'Turbidimeter Vial',
  's1-r34':'Free Chlorine Reagent Set',
  's1-r36':'Turbidimeter Wiper'
};

test('Hach photo, shopping, email and QR links use the US store without changing image identity',()=>{
  const item={...catalog.items.find(i=>i.id==='s1-r35'),productUrl:'https://sea.hach.com/p-desiccant-cartridge-for-tu5300sc-and-tu5400sc-laser-turbidimeter/LZY876'};
  const expected=item.productUrl.replace('sea.hach.com','www.hach.com');
  const legacy={[item.id]:{...images[item.id],productUrl:item.productUrl}};
  assert.equal(productImages.find(item,legacy).productUrl,expected);
  assert.equal(productImages.find(item,legacy).src,images[item.id].src);
  assert.equal(cards.productUrl(item),expected);
  const email=buildReportEmail({date:'2026-10-28',operator:'Test',status:'complete',items:[item],counts:{[item.id]:0}},'Operating Supplies');
  assert.ok(email.html.includes(expected));assert.ok(!email.html.includes('sea.hach.com'));
  for(const photo of Object.values(images))assert.notEqual(new URL(photo.productUrl).hostname,'sea.hach.com');
  assert.equal(productImages.productUrl('https://sea.hach.com.evil.example/item'),'https://sea.hach.com.evil.example/item');
  assert.equal(productImages.productUrl('javascript:alert(1)'),'');
  assert.equal(productImages.productUrl('https://user:password@sea.hach.com/item'),'');
});
test('all five renamed products retain their existing local photos in cards and emails',() => {
  const items = Object.entries(renamed).map(([id,description]) => ({...catalog.items.find(i => i.id === id),description}));
  for (const item of items) {
    const photo = productImages.find(item,images);
    assert.equal(photo?.src,images[item.id].src,item.description);
    assert.ok(fs.existsSync(path.join(__dirname,'../public',photo.src.slice(1))));
    assert.equal(cards.details(item,images).image,photo.src);
    assert.match(cards.card(item,images),/class="bin-photo"/);
  }
  const email = buildReportEmail({date:'2026-10-17',operator:'Test',status:'complete',items,counts:Object.fromEntries(items.map(i => [i.id,0]))},'Operating Supplies');
  assert.equal(email.attachments.length,5);
  assert.deepEqual(email.attachments.map(a => a.filename).sort(),items.map(i => i.id + '.jpg').sort());
});
test('photo matching keeps product identity checks when names or product numbers change',() => {
  const item = {...catalog.items.find(i => i.id === 's1-r33'),description:'Turbidimeter Vial'};
  assert.equal(productImages.find({...item,itemNumber:'different-product'},images),null);
  assert.equal(productImages.find({...item,id:'unknown-item'},images),null);
  assert.equal(productImages.find(item,{[item.id]:{...images[item.id],sourceType:'unapproved'}}),null);
  assert.equal(productImages.find(item,{[item.id]:{...images[item.id],src:'/private/file.jpg'}}),null);
  const numberless = {...item,itemNumber:'N/A'};
  const manifest = {[item.id]:{...images[item.id],description:item.description,itemNumber:'N/A'}};
  assert.ok(productImages.find(numberless,manifest));
  assert.equal(productImages.find({...numberless,description:'Another item'},manifest),null);
});

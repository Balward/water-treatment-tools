
const {test}=require('node:test'),assert=require('node:assert/strict');
const {format,countSize,normalize}=require('../public/pack-sizes');
const catalog=require('../catalog.json');
const {buildReportEmail}=require('../email');
test('reviewed pack labels preserve quantities, counting units and custom edits',()=>{
 const item=id=>catalog.items.find(i=>i.id===id);
 assert.equal(format(item('s1-r5')),'500 mL / bottle');
 assert.equal(format(item('s1-r16')),'60 boxes / case (280 wipes / box; 16,800 total)');
 assert.equal(normalize(item('s1-r43')).caseSize,'1 gallon / bottle');
 assert.equal(normalize(item('s1-r43')).itemNumber,'VINE30-128');
 assert.equal(normalize({...item('s1-r43'),itemNumber:'custom',caseSize:'2 L / bottle'}).itemNumber,'custom');
 assert.equal(normalize({...item('s1-r43'),itemNumber:'custom',caseSize:'2 L / bottle'}).caseSize,'2 L / bottle');
 assert.equal(normalize(item('s1-r42')).productUrl,'https://www.amazon.com/dp/B07VBZ9384');
 assert.equal(normalize(item('s1-r42')).caseSize,'16 fl oz / bottle');
 assert.equal(normalize({...item('s1-r42'),caseSize:'1 bottle'}).caseSize,'16 fl oz / bottle');
 assert.equal(normalize({...item('s1-r42'),caseSize:'32 fl oz / bottle'}).caseSize,'32 fl oz / bottle','Explicit custom sizes are preserved');
 assert.equal(format(item('s1-r12')),'10 L / cubetainer');
 assert.equal(format(item('s1-r14')),'10 boxes / case (250 gloves / box; 2,500 total)');
 assert.equal(format(item('s1-r15')),'10 boxes / case (225 gloves / box; 2,250 total)');
 assert.equal(countSize(item('s1-r9')),'Cubetainer');
 assert.equal(countSize(item('s1-r12')),'Cubetainer');
 assert.equal(format(item('s1-r38')),'10 tubes / pack','Purchase pack is not converted into the counting unit Each');
 for (const [id,number] of [['s1-r38','A3-SNKL-T'],['s1-r39','A3-SNF-T']]) {
  const updated=normalize(item(id));
  assert.equal(updated.itemNumber,number);
  assert.equal(updated.countSize,'Each');
  assert.equal(format({...updated,caseSize:'10/pk'}),'10 tubes / pack');
  assert.equal(normalize({...item(id),itemNumber:'custom'}).itemNumber,'custom');
  assert.ok(require('../public/images/manifest.json').items[id].allowedItemNumbers.includes(number));
 }
 assert.equal(format(item('s2-r5')),null,'Missing pack sizes stay unspecified');
 assert.equal(format({...item('s1-r5'),caseSize:'250 mL / bottle'}),'250 mL / bottle','User edits take precedence');
 assert.equal(format({...item('s1-r5'),itemNumber:'other'}),'1BTL/500mL','An unrelated product cannot inherit verified pack information');
 for(const id of ['s1-r6','s1-r7','s1-r8']) {
  assert.equal(normalize(item(id)).countSize,'Box');
  const previousPack={...item(id),countSize:'Pack',caseSize:'20 singlets / pack (20 mL each)'};
  assert.equal(countSize(previousPack),'Box');
  assert.equal(format(previousPack),'20 singlets / box (20 mL each)');
 }
 for(const [id,name] of [['s1-r14','Nitrile Gloves - 3 mil - Large'],['s1-r15','Nitrile Gloves - 3 mil - XL'],['s1-r40','Black Nitrile Gloves - 5 mil - Large'],['s1-r41','Black Nitrile Gloves - 5 mil - XL']]) {
  assert.equal(normalize(item(id)).description,name);
  assert.equal(normalize({...item(id),description:'Custom gloves'}).description,'Custom gloves');
  assert.equal(format({...normalize(item(id)),caseSize:item(id).caseSize}),format(item(id)));
 }
 const old=item('s1-r5'),before=JSON.stringify(old);
 const report=buildReportEmail({items:[old],counts:{[old.id]:0},operator:'Test',date:'2026-10-11',status:'complete'},'Supplies');
 assert.ok(report.text.includes('Pack: 500 mL / bottle'));assert.ok(report.html.includes('Pack: 500 mL / bottle'));
 assert.equal(JSON.stringify(old),before,'Historical snapshot remains untouched');
 assert.equal(old.countSize,'Bottle');assert.equal(old.caseSize,'1BTL/500mL');
});

test('confirmed unit-label aliases retain references from old completed inventories',async t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {createApp}=require('../server');
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'pack-alias-'));
 const items=catalog.items.filter(i=>i.sourceSheet===1);
 fs.writeFileSync(path.join(dataDir,'inventories.json'),JSON.stringify({inventories:[{id:'old',worksheet:'operating',status:'complete',date:'2026-10-10',completedAt:'2026-10-10T12:00:00Z',updatedAt:'2026-10-10T12:00:00Z',items,counts:{'s1-r6':3,'s1-r9':2,'s1-r14':4}}]}));
 const server=createApp({dataDir,mailer:{enabled:false}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dataDir,{recursive:true,force:true});});
 const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/inventories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operator:'Test',worksheet:'operating',date:'2026-10-11'})});
 assert.equal(response.status,201);const run=await response.json();
 assert.equal(run.items.find(i=>i.id==='s1-r6').countSize,'Box');
 assert.equal(run.items.find(i=>i.id==='s1-r9').countSize,'Cubetainer');
 assert.equal(run.previousCounts['s1-r6'],3);assert.equal(run.previousCounts['s1-r9'],2);assert.equal(run.previousCounts['s1-r14'],4);assert.deepEqual(run.counts,{});
});

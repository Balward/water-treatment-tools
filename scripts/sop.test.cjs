const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),express=require('express');
const model=require('../apps/sop-creator/model'),register=require('../sop-api');
test('Safety concerns remain distinct from security and older SOPs still open',()=>{
  const doc=model.blank();doc.safety='Test the safety shower.';doc.security='Restrict panel access.';
  const normalized=model.validate(doc),html=require('../apps/sop-creator/document').render(normalized);
  assert.match(html,/<h2>Safety Concerns<\/h2><ul><li>Test the safety shower\.<\/li>/);
  assert.match(html,/<h2>Security Concerns<\/h2><ul><li>Restrict panel access\.<\/li>/);
  delete doc.safety;assert.equal(model.validate(doc).safety,'');
  assert.throws(()=>model.validate({...doc,safety:5}));
});
test('Revised Date follows the latest valid revision date regardless of row order',()=>{
  const doc=model.blank();assert.equal(model.revisedDate(doc),'');
  doc.revisionHistory=[{date:'2026-11-05'},{date:''},{date:'2026-11-06'},{date:'2026-10-01'}];
  assert.equal(model.revisedDate(doc),'2026-11-06');doc.revisionHistory.reverse();assert.equal(model.revisedDate(doc),'2026-11-06');
  doc.revisionHistory=doc.revisionHistory.filter(row=>row.date!=='2026-11-06');assert.equal(model.revisedDate(doc),'2026-11-05');
  assert.equal(model.revisedDate({revisionHistory:[{date:'2026-02-30'},{date:'invalid'}]}),'');
});
test('Water treatment tags validate, deduplicate, and migrate older SOPs',()=>{
  const doc=model.blank();doc.tags=['pH','Calibration','Instrumentation','pH'];assert.deepEqual(model.validate(doc).tags,['pH','Calibration','Instrumentation']);
  delete doc.tags;assert.deepEqual(model.validate(doc).tags,[]);
  assert.throws(()=>model.validate({...doc,tags:['Unlisted Tag']}),/tag list/);
  assert.throws(()=>model.validate({...doc,tags:model.tags.slice(0,21)}),/20 tags/);
});
test('SOP model preserves the template structure, photos, and ordered steps, while rejecting unsafe data',()=>{
  const doc=model.blank();doc.title='Check A Pump';const step=model.step();step.instruction='Check the gauge.';step.substeps.push({id:crypto.randomUUID(),text:'Record the reading.'});step.photos.push({id:crypto.randomUUID(),data:'data:image/png;base64,aGVsbG8=',caption:'Gauge'});doc.groups[0].steps.push(step);
  assert.deepEqual(model.validate(doc),doc);
  const withTable=structuredClone(doc);withTable.groups[0].steps[0].tables.push(model.table());
  withTable.groups[0].steps[0].tables[0].rows[0]=['Pressure','45 psi'];assert.deepEqual(model.validate(withTable),withTable);
  withTable.groups[0].steps[0].tables[0].rows[0].pop();assert.throws(()=>model.validate(withTable),/column count/);
  const noTables=structuredClone(doc);delete noTables.groups[0].steps[0].tables;assert.deepEqual(model.validate(noTables).groups[0].steps[0].tables,[],'Older SOPs open without tables');
  const older=structuredClone(doc);delete older.revisionHistory;assert.deepEqual(model.validate(older).revisionHistory,[],'Existing SOPs open without a revision table');
  const withHistory=structuredClone(doc);withHistory.revisionHistory.push({id:crypto.randomUUID(),date:'2026-11-05',summary:'Initial issue',revisedBy:'Operations',approvedBy:''});
  assert.deepEqual(model.validate(withHistory),withHistory);
  const numbered=structuredClone(withHistory);numbered.revisionHistory[0].version='1.0';assert.deepEqual(model.validate(numbered),withHistory,'Older numbered entries retain their dates and details without revision numbers');
  withHistory.revisionHistory[0].date='2026-02-30';assert.throws(()=>model.validate(withHistory),/revision effective date/);
  const legacy=structuredClone(doc);legacy.groups[0].steps[0].title='Inspect The Gauge';
  const migrated=model.validate(legacy);
  assert.equal(migrated.groups[0].steps[0].instruction,'Inspect The Gauge\n\nCheck the gauge.');
  assert.equal(migrated.groups[0].steps[0].title,undefined);
  assert.deepEqual(model.validate(migrated),migrated,'Older titles migrate once without losing content');
  assert.deepEqual(model.sections.map(section=>section[1]),['Purpose','Background','Notes','Safety Concerns','Security Concerns','Equipment']);
  assert.throws(()=>model.validate({...doc,effectiveDate:'2026-02-30'}));
  assert.throws(()=>model.validate({...doc,id:'../../file'}));
  assert.throws(()=>model.validate({...doc,groups:[{...doc.groups[0],id:step.id}]}),/Duplicate/);
  step.photos[0].data='data:image/svg+xml;base64,aGVsbG8=';assert.throws(()=>model.validate(doc),/Photos/);
});
test('SOP API persists drafts and photos, protects concurrent saves per document, and retains previous versions',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sop-api-'));
  function app(){const instance=express();instance.use(express.json({limit:'16mb'}));register(instance,{directory});return instance;}
  const server=app().listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});});
  const put=(doc,origin=base)=>fetch(base+'/api/sops/'+doc.id,{method:'PUT',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(doc)});
  const draft=model.blank();draft.title='Pump Inspection';draft.groups[0].steps.push(model.step());
  assert.equal((await put(draft,'https://elsewhere.example')).status,403);
  const created=await put(draft);assert.equal(created.status,200);const first=await created.json();assert.equal(first.revision,1);
  assert.equal((await put(draft)).status,409);
  const another=model.blank();another.title='Second SOP';assert.equal((await put(another)).status,200,'Another SOP saves independently');
  first.purpose='Routine inspection';const responses=await Promise.all([put(first),put(first)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const latest=await(await fetch(base+'/api/sops/'+first.id)).json();assert.equal(latest.revision,2);assert.equal(latest.purpose,'Routine inspection');
  const backup=JSON.parse(await fs.readFile(path.join(directory,'history',first.id+'-1.json'),'utf8'));assert.equal(backup.purpose,'');
  const library=await(await fetch(base+'/api/sops')).json();assert.equal(library.length,2);assert.equal(library[0].groups,undefined,'Library listing omits photo and document bodies');
  const restarted=app().listen(0,'127.0.0.1');await new Promise(resolve=>restarted.once('listening',resolve));try{const saved=await(await fetch('http://127.0.0.1:'+restarted.address().port+'/api/sops/'+first.id)).json();assert.equal(saved.purpose,'Routine inspection');}finally{await new Promise(resolve=>restarted.close(resolve));}
  await fs.writeFile(path.join(directory,first.id+'.json'),'broken');assert.equal((await put(latest)).status,500);assert.equal(await fs.readFile(path.join(directory,first.id+'.json'),'utf8'),'broken','Unreadable storage is never replaced');
});

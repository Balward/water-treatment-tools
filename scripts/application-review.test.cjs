const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),express=require('express');
const model=require('../apps/application-review/model'),register=require('../application-review-api');
test('one to four assigned reviewers determine completion, pending counts, and printed perspectives',()=>{
  const report=require('../apps/application-review/report');
  for(const slots of [[0],[0,2],[0,1,3],[0,1,2,3]]){
    let state=model.blank();const reviewers=Array.from({length:4},(_,slot)=>slots.includes(slot)?'Person '+slot:'');state=model.apply(state,{type:'settings',title:'Variable Reviewers',reviewers,points:state.points});state=model.apply(state,{type:'applicant',name:'Test Applicant',state:'CO',wage:null,licenses:''});
    assert.equal(model.summarize(state)[0].pending,slots.length);
    state=model.apply(state,{type:'review',id:'APP-001',slot:slots[0],vote:'',notes:'Notes only'});assert.equal(model.summarize(state)[0].count,0);
    slots.forEach((slot,i)=>{state=model.apply(state,{type:'review',id:'APP-001',slot,vote:i%2?'No':'Yes',notes:'Recorded'});const row=model.summarize(state)[0];assert.equal(row.required,slots.length);assert.equal(row.pending,slots.length-i-1);assert.equal(row.status,i===slots.length-1?'Complete':'Pending');});
    const html=report.render(state,'APP-001',new Date(),slots[0]);assert.equal((html.match(/scope="row"/g)||[]).length,slots.length);assert.ok(html.includes(slots.length+' Of '+slots.length+' Reviews'));
    assert.throws(()=>model.apply(state,{type:'settings',title:state.title,reviewers:['','','',''],points:state.points}),/at least one/);
    if(slots.length<4){const reviewers=[...state.reviewers];reviewers[reviewers.indexOf('')]='Added Reviewer';state=model.apply(state,{type:'settings',title:state.title,reviewers,points:state.points});assert.equal(model.summarize(state)[0].status,'Pending');assert.equal(model.summarize(state)[0].pending,1);}
  }
  assert.equal(model.summarize(model.apply(model.blank(),{type:'applicant',name:'Unconfigured',state:'',wage:null,licenses:''}))[0].status,'Not Started');
});
test('bulk edit changes existing details atomically without altering IDs, votes, notes or archive status',()=>{
  let state=model.blank();state.reviewers=['One','Two','Three','Four'];for(const name of ['First Applicant','Second Applicant'])state=model.apply(state,{type:'applicant',name,state:'CO',wage:null,licenses:''});state=model.apply(state,{type:'review',id:'APP-001',slot:0,vote:'Yes',notes:'Preserve this review'});state=model.apply(state,{type:'archive',id:'APP-002'});
  const before=structuredClone(state),changes=state.applicants.map(a=>({id:a.id,firstName:a.firstName,lastName:a.lastName,country:a.country,state:a.state,wage:35,licenses:'Water A'})),next=model.apply(state,{type:'bulk-edit-applicants',applicants:changes});
  assert.equal(next.revision,state.revision+1);assert.equal(next.nextId,state.nextId);assert.deepEqual(next.applicants.map(a=>a.id),state.applicants.map(a=>a.id));assert.deepEqual(next.applicants[0].reviews,state.applicants[0].reviews);assert.equal(next.applicants[1].archived,true);assert.ok(next.applicants.every(a=>a.wage===35&&a.licenses==='Water A'));assert.deepEqual(state,before);
  for(const applicants of [[changes[0],{...changes[1],lastName:''}],[changes[0],{...changes[1],id:'APP-999'}],[changes[0],changes[0]]]){assert.throws(()=>model.apply(state,{type:'bulk-edit-applicants',applicants}));assert.deepEqual(state,before);}
});
test('moving applicants updates both reviews atomically, remaps reviewers by name and prevents ID collisions',()=>{
  const sets=require('../apps/application-review/hiring-reviews');let source=model.blank(),target=model.blank();source.reviewers=['One','Two','Three','Four'];target.reviewers=['Two','One','Three','Four'];
  for(const name of ['Move Me','Leave Me'])source=model.apply(source,{type:'applicant',name,state:'CO',wage:31,licenses:'Water A'});
  source=model.apply(source,{type:'review',id:'APP-001',slot:0,vote:'Yes',notes:'Preserve vote and note'});source=model.apply(source,{type:'review',id:'APP-001',slot:1,vote:'',notes:'Preserve notes-only review'});
  target=model.apply(target,{type:'applicant',name:'Already Here',state:'CO',wage:null,licenses:''});
  const current=sets.validate({version:2,revision:10,sets:[{id:'review-source',team:'Maintenance',position:'Tech',review:source},{id:'review-target',team:'Water Treatment',position:'Utility Operator',review:target}]});
  const action={type:'move-applicants',setId:'review-source',revision:source.revision,targetId:'review-target',targetRevision:target.revision,ids:['APP-001']},before=structuredClone(current),next=sets.apply(current,action),moved=next.sets[1].review.applicants[1];
  assert.equal(next.revision,11);assert.equal(next.sets[0].review.revision,source.revision+1);assert.equal(next.sets[1].review.revision,target.revision+1);assert.equal(next.sets[0].review.applicants.length,1);assert.equal(next.sets[0].review.applicants[0].name,'Leave Me');assert.equal(next.sets[0].review.nextId,source.nextId);assert.equal(moved.id,'APP-002');assert.equal(moved.name,'Move Me');assert.deepEqual(moved.reviews[1],source.applicants[0].reviews[0]);assert.deepEqual(moved.reviews[0],source.applicants[0].reviews[1]);assert.deepEqual(next.sets[1].review.applicants[0],target.applicants[0]);assert.deepEqual(current,before);
  for(const change of [{targetRevision:0},{revision:0},{ids:['APP-999']},{ids:['APP-001','APP-001']},{targetId:'review-source'}])assert.throws(()=>sets.apply(current,{...action,...change}));
  const mismatch=structuredClone(current);mismatch.sets[1].review.reviewers[1]='Someone Else';assert.throws(()=>sets.apply(mismatch,action),/Assign One/);assert.deepEqual(mismatch.sets[0].review,source);
  const archived=structuredClone(current);archived.sets[1].archived=true;assert.throws(()=>sets.apply(archived,action),/Restore the destination/);
});
test('first and last names support surname sorting, legacy imports, and editing without losing reviews',()=>{
  let state=model.blank();state.reviewers=['One','Two','Three','Four'];
  state=model.apply(state,{type:'applicant',name:'Mary Jane Smith',state:'CO',wage:null,licenses:''});
  state=model.apply(state,{type:'review',id:'APP-001',slot:0,vote:'Yes',notes:'Preserved Notes'});
  assert.equal(state.applicants[0].firstName,'Mary Jane');assert.equal(state.applicants[0].lastName,'Smith');assert.equal(state.applicants[0].name,'Mary Jane Smith');
  state=model.apply(state,{type:'applicant',id:'APP-001',firstName:'Mary Jane',lastName:'De La Cruz',state:'CO',wage:null,licenses:''});assert.equal(state.applicants[0].name,'Mary Jane De La Cruz');assert.equal(state.applicants[0].reviews[0].notes,'Preserved Notes');
  state=model.apply(state,{type:'applicant',firstName:'Zoe',lastName:'Adams',state:'',wage:null,licenses:''});state=model.apply(state,{type:'applicant',firstName:'Amy',lastName:'Adams',state:'',wage:null,licenses:''});
  assert.deepEqual([...state.applicants].sort(model.compareLastName).map(a=>a.name),['Amy Adams','Zoe Adams','Mary Jane De La Cruz']);
  assert.equal(model.displayName(state.applicants[0]),'De La Cruz, Mary Jane');
  assert.equal(model.displayName({name:'Smith, Mary Jane'}),'Smith, Mary Jane');
  assert.equal(model.displayName({name:'Single'}),'Single');
  assert.throws(()=>model.apply(state,{type:'applicant',firstName:'Only',lastName:'',state:'',wage:null,licenses:''}),/last name/);
  const old=model.blank();old.applicants=[{id:'APP-001',name:'Smith, Mary Jane',state:'CO',wage:null,licenses:'',reviews:{}}];const migrated=model.validate(old);assert.equal(migrated.applicants[0].lastName,'Smith');assert.equal(migrated.applicants[0].firstName,'Mary Jane');assert.equal(model.validate(migrated).applicants[0].name,'Smith, Mary Jane');
});
test('bulk applicants append atomically with stable IDs, one revision, and unchanged existing votes',()=>{
  let state=model.blank();state.reviewers=['One','Two','Three','Four'];state=model.apply(state,{type:'applicant',name:'Existing',state:'CO',wage:30,licenses:'Water A'});state=model.apply(state,{type:'review',id:'APP-001',slot:0,vote:'Yes',notes:'Preserve'});
  const before=structuredClone(state),rows=[{name:'Domestic',country:'US',state:'NY',wage:0,licenses:'Maintenance'},{name:'International',country:'CA',state:'CO',wage:null,licenses:''}];
  const next=model.apply(state,{type:'bulk-applicants',applicants:rows});assert.equal(next.revision,state.revision+1);assert.deepEqual(next.applicants[0],before.applicants[0]);assert.deepEqual(next.applicants.map(a=>a.id),['APP-001','APP-002','APP-003']);assert.equal(next.applicants[1].wage,0);assert.equal(next.applicants[2].state,'');assert.equal(next.nextId,4);
  assert.throws(()=>model.apply(state,{type:'bulk-applicants',applicants:[rows[0],{...rows[1],name:''}]}),/Row 2/);assert.deepEqual(state,before);
  for(const applicants of [[],Array(101).fill(rows[0]),null])assert.throws(()=>model.apply(state,{type:'bulk-applicants',applicants}),/between 1 and 100/);
});
test('country defaults preserve old records, international applicants have no state, and US state writes use state codes',()=>{
  const reference=require('../apps/application-review/reference-data');assert.equal(reference.countryCodes.length,249);assert.equal(new Set(reference.countryCodes).size,249);assert.equal(reference.states.length,56);
  let state=model.apply(model.blank(),{type:'applicant',name:'Domestic',state:'CO',wage:null,licenses:''});assert.equal(state.applicants[0].country,'US');
  state=model.apply(state,{type:'applicant',name:'International',country:'CA',state:'CO',wage:null,licenses:''});assert.equal(state.applicants[1].state,'');assert.equal(reference.location(state.applicants[1]),'Canada');
  const printed=require('../apps/application-review/report').render(state);assert.ok(printed.includes('Canada')&&printed.includes('CO, USA'));
  state=model.apply(state,{type:'applicant',id:'APP-002',name:'International',country:'US',state:'NY',wage:null,licenses:''});assert.equal(state.applicants[1].state,'NY');
  assert.throws(()=>model.apply(state,{type:'applicant',name:'Invalid',country:'XX',state:'',wage:null,licenses:''}),/country/);
  assert.throws(()=>model.apply(state,{type:'applicant',name:'Invalid',country:'US',state:'Ontario',wage:null,licenses:''}),/state code/);
  const legacy=structuredClone(state);delete legacy.applicants[0].country;legacy.applicants[0].state='Legacy Region';assert.equal(model.validate(legacy).applicants[0].state,'Legacy Region');
});
test('structured review titles use canonical teams and validated month/year rather than a supplied title',()=>{
  const sets=require('../apps/application-review/hiring-reviews');let collection=sets.blank();
  collection=sets.apply(collection,{type:'create-set',revision:0,team:'Water',position:'Water Treatment Operator',month:10,year:2026,title:'Ignored Manual Title'},undefined,'review-water');
  let selected=sets.response(collection,'review-water');assert.equal(selected.review.title,'Water Treatment Operator - Water Treatment - October 2026');assert.equal(selected.hiringReview.team,'Water Treatment');
  collection=sets.apply(collection,{type:'settings',setId:'review-water',revision:0,team:'Laboratory Services',position:'Laboratory Analyst',month:11,year:2027,title:'Ignored Again',reviewers:['One','','',''],points:selected.review.points});
  selected=sets.response(collection,'review-water');assert.equal(selected.review.title,'Laboratory Analyst - Laboratory Services - November 2027');
  collection=sets.apply(collection,{type:'import',setId:'review-water',revision:1,state:model.blank()});assert.equal(sets.response(collection,'review-water').review.title,selected.review.title);
  assert.throws(()=>sets.apply(collection,{type:'create-set',revision:collection.revision,team:'Other Team',position:'Tech',month:10,year:2026},undefined,'review-bad'),/team/);
  assert.throws(()=>sets.apply(collection,{type:'create-set',revision:collection.revision,team:'Maintenance',position:'Tech',month:0,year:2026},undefined,'review-bad'),/month and year/);
});
test('whole-review archive preserves records, blocks all edits including legacy clients, and restores editing',async t=>{
  const sets=require('../apps/application-review/hiring-reviews'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'archive-review-api-'));
  const app=express();app.use(express.json());register(app,{directory:dir});const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});});
  const get=async route=>await(await fetch(base+'/api/application-review'+route)).json();
  const post=async(route,body,status=200)=>{const response=await fetch(base+'/api/application-review'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;};
  let original=await get('/sets/'+sets.originalId);assert.equal(original.hiringReview.archived,false);
  original=await post('',{type:'settings',revision:0,title:'Original',reviewers:['One','Two','Three','Four'],points:original.review.points});
  original=await post('',{type:'applicant',revision:original.revision,name:'Preserved Applicant',state:'CO',wage:30,licenses:'Water A'});
  original=await post('',{type:'review',revision:original.revision,id:'APP-001',slot:0,vote:'Yes',notes:'Preserved Note'});
  const directory=await get('/sets'),other=await post('/sets',{type:'create-set',revision:directory.revision,team:'Maintenance',position:'Tech'},201);
  const archived=await post('/sets/'+sets.originalId,{type:'archive-set',revision:original.revision,archived:true});
  assert.equal(archived.hiringReview.archived,true);assert.ok(Date.parse(archived.hiringReview.archivedAt));assert.equal(archived.review.revision,original.revision+1);
  assert.deepEqual(archived.review.applicants,original.applicants);assert.deepEqual(archived.review.reviewers,original.reviewers);assert.deepEqual(archived.review.points,original.points);
  for(const type of ['applicant','bulk-applicants','review','settings','import','delete','archive'])await post('/sets/'+sets.originalId,{type,revision:archived.review.revision},409);
  await post('',{type:'delete',revision:archived.review.revision,id:'APP-001'},409);
  assert.deepEqual((await get('/sets/'+other.hiringReview.id)).review,other.review);
  await post('/sets/'+other.hiringReview.id,{type:'archive-set',revision:other.review.revision,archived:true});assert.ok((await get('/sets')).sets.every(s=>s.archived),'All sets may be archived without losing records');
  const restored=await post('/sets/'+sets.originalId,{type:'archive-set',revision:archived.review.revision,archived:false});assert.equal(restored.hiringReview.archived,false);assert.equal(restored.hiringReview.archivedAt,null);assert.deepEqual(restored.review.applicants,original.applicants);
  await post('',{type:'review',revision:restored.review.revision,id:'APP-001',slot:0,vote:'Maybe',notes:'Editable again'});
});
test('vote visibility uses the selected reviewer on every page and print, and comparison waits for all own votes',()=>{
  const report=require('../apps/application-review/report');let state=model.blank();state.reviewers=['One','Two','Three','Four'];
  state=model.apply(state,{type:'applicant',name:'First',state:'CO',wage:null,licenses:''});state=model.apply(state,{type:'applicant',name:'Second',state:'CO',wage:null,licenses:''});
  state=model.apply(state,{type:'review',id:'APP-001',slot:0,vote:'Yes',notes:'SECRET_PEER_NOTE'});
  assert.equal(model.canReveal(state.applicants[0],null),false);assert.equal(model.canReveal(state.applicants[0],1),false);assert.equal(model.canCompare(state,0),false);
  for(const slot of [null,1]){const hidden=report.render(state,'APP-001',new Date(),slot);assert.ok(!hidden.includes('SECRET_PEER_NOTE'));assert.ok(!hidden.includes('report-vote-yes'));}
  state=model.apply(state,{type:'review',id:'APP-001',slot:1,vote:'',notes:'My draft'});assert.equal(model.canReveal(state.applicants[0],1),false);
  state=model.apply(state,{type:'review',id:'APP-001',slot:1,vote:'Maybe',notes:'My final'});assert.equal(model.canReveal(state.applicants[0],1),true);assert.equal(model.canCompare(state,1),false);assert.ok(report.render(state,'APP-001',new Date(),1).includes('SECRET_PEER_NOTE'));
  state=model.apply(state,{type:'review',id:'APP-002',slot:1,vote:'No',notes:''});assert.equal(model.canCompare(state,1),true);
  state=model.apply(state,{type:'review',id:'APP-001',slot:1,vote:'',notes:'Cleared vote'});assert.equal(model.canCompare(state,1),false);assert.ok(!report.render(state,'APP-001',new Date(),1).includes('SECRET_PEER_NOTE'));
});
test('printed reviews retain complete notes, label votes, distinguish blank scores and escape applicant content',()=>{
  const report=require('../apps/application-review/report');let state=model.blank();state.reviewers=['One','Two','Three','Four'];
  state=model.apply(state,{type:'applicant',name:'Flo <Meter>',state:'CO',wage:null,licenses:'A & B'});
  const notes='Long note '.repeat(800)+'\nLast line <script>test</script>';
  state=model.apply(state,{type:'review',id:'APP-001',slot:0,vote:'Yes',notes});
  const html=report.render(state,null,new Date('2026-10-31T18:00:00Z'),0);
  assert.match(html,/report-summary-table/);assert.match(html,/report-reviews/);assert.match(html,/report-vote-yes/);assert.match(html,/report-vote-blank/);assert.match(html,/Last line &lt;script&gt;test&lt;\/script&gt;/);assert.match(html,/&lt;Meter&gt;, Flo/);assert.ok(!html.includes('<script>'));
  assert.equal((html.match(/Long note /g)||[]).length,800);
  const individual=report.render({...state,hiringReview:{team:'Maintenance',position:'Maintenance Tech'}},'APP-001');assert.ok(!individual.includes('report-summary-table'));assert.ok(individual.includes('Partial Points'));assert.ok(individual.includes('Maintenance / Maintenance Tech'));
});
test('workbook scoring preserves blanks, notes-only reviews, zero scores, competition ranks and stable IDs',()=>{
  let state=model.blank();state=model.apply(state,{type:'settings',title:'Operator Recruitment',reviewers:['A','B','C','D'],points:state.points});
  for(const name of ['First','Second','Third','Fourth'])state=model.apply(state,{type:'applicant',name,state:'CO',wage:null,licenses:''});
  state=model.apply(state,{type:'review',id:'APP-001',slot:0,vote:'',notes:'Notes Only'});
  assert.equal(model.summarize(state)[0].score,null);assert.equal(model.summarize(state)[0].count,0);
  for(const [id,slot,vote] of [['APP-001',0,'Yes'],['APP-001',1,'Yes'],['APP-001',2,'Maybe'],['APP-001',3,'No'],['APP-002',0,'Yes'],['APP-002',1,'Yes'],['APP-002',2,'Maybe'],['APP-003',0,'No']])state=model.apply(state,{type:'review',id,slot,vote,notes:'Candidate '+id});
  const rows=model.summarize(state);assert.equal(rows[0].score,9);assert.equal(rows[0].status,'Complete');assert.equal(rows[1].status,'Pending');assert.deepEqual(rows.map(a=>a.rank),[1,1,3,null]);assert.equal(rows[2].score,0);
  state=model.apply(state,{type:'applicant',id:'APP-001',name:'Renamed',state:'CO',wage:30,licenses:'Water A'});assert.equal(state.applicants[0].reviews[0].notes,'Candidate APP-001');
  state=model.apply(state,{type:'archive',id:'APP-004'});state=model.apply(state,{type:'applicant',name:'New',state:'',wage:null,licenses:''});assert.equal(state.applicants.at(-1).id,'APP-005');
  assert.throws(()=>model.apply(state,{type:'settings',title:'Test',reviewers:['Different','B','C','D'],points:state.points}),/reassigned/);
  assert.throws(()=>model.validate({...state,applicants:[...state.applicants,state.applicants[0]]}),/unique/);
  assert.throws(()=>model.validate({...state,points:{Yes:Infinity,Maybe:1,No:0}}),/Points/);
  const otherReview=structuredClone(state.applicants[1].reviews);
  state=model.apply(state,{type:'delete',id:'APP-001'});
  assert.ok(!state.applicants.some(a=>a.id==='APP-001'));assert.deepEqual(state.applicants.find(a=>a.id==='APP-002').reviews,otherReview);
  state=model.apply(state,{type:'delete',id:'APP-004'});assert.ok(!state.applicants.some(a=>a.id==='APP-004'));
  state=model.apply(state,{type:'delete',id:'APP-005'});
  state=model.apply(state,{type:'applicant',name:'After Deletion',state:'',wage:null,licenses:''});assert.equal(state.applicants.at(-1).id,'APP-006');
  assert.throws(()=>model.apply(state,{type:'delete',id:'APP-999'}),/not found/);
});
test('shared storage persists reviews, rejects stale writes, keeps recovery copies and fails closed on corrupt data',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'application-review-api-')),app=express();app.use(express.json());register(app,{directory:dir});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});});
  const get=async()=>await(await fetch(base+'/api/application-review')).json();
  const post=async(body,origin=base)=>fetch(base+'/api/application-review',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  assert.equal((await get()).revision,0);
  assert.equal((await post({revision:0,type:'applicant',name:'Test',state:'CO',wage:0,licenses:''},'https://elsewhere.example')).status,403);
  const action={revision:0,type:'applicant',name:'Test',state:'CO',wage:0,licenses:''};
  assert.deepEqual((await Promise.all([post(action),post(action)])).map(r=>r.status).sort(),[200,409]);
  const saved=await get();assert.equal(saved.applicants[0].wage,0);assert.equal(saved.revision,1);assert.equal(JSON.parse(await fs.readFile(path.join(dir,'before-1.json'),'utf8')).revision,0);
  assert.equal((await post({revision:1,type:'delete',id:saved.applicants[0].id})).status,200);
  assert.equal((await get()).applicants.length,0);
  assert.equal(require('../apps/application-review/hiring-reviews').validate(JSON.parse(await fs.readFile(path.join(dir,'before-2.json'),'utf8'))).sets[0].review.applicants.length,1);
  assert.equal((await post({revision:1,type:'delete',id:saved.applicants[0].id})).status,409);
  await fs.writeFile(path.join(dir,'review.json'),'broken');assert.equal((await fetch(base+'/api/application-review')).status,500);assert.equal((await post({...action,revision:1})).status,500);assert.equal(await fs.readFile(path.join(dir,'review.json'),'utf8'),'broken');
});
test('multiple positions preserve legacy records, share reviewer assignments without votes, and isolate revisions and imports',async t=>{
  const sets=require('../apps/application-review/hiring-reviews'),dir=await fs.mkdtemp(path.join(os.tmpdir(),'hiring-reviews-api-'));
  let legacy=model.blank();legacy=model.apply(legacy,{type:'settings',title:'Existing Applicants',reviewers:['Same Person','Two','Three','Four'],points:legacy.points});legacy=model.apply(legacy,{type:'applicant',name:'Water Applicant',state:'CO',wage:30,licenses:'Water A'});legacy=model.apply(legacy,{type:'review',id:'APP-001',slot:0,vote:'Yes',notes:'Water experience'});
  const legacyText=JSON.stringify(legacy);await fs.writeFile(path.join(dir,'review.json'),legacyText);
  const app=express();app.use(express.json());register(app,{directory:dir});const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),base='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});});
  const get=async route=>await(await fetch(base+'/api/application-review'+route)).json();
  const post=async(route,body,status=200)=>{const response=await fetch(base+'/api/application-review'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;};
  const migrated=await get('/sets/review-original');assert.deepEqual(migrated.review,legacy);assert.equal(await fs.readFile(path.join(dir,'review.json'),'utf8'),legacyText,'Reading migration does not rewrite saved records');
  const created=await post('/sets',{revision:migrated.directory.revision,type:'create-set',team:'Maintenance',position:'Maintenance Tech',copyFrom:sets.originalId},201),id=created.hiringReview.id;
  assert.deepEqual(created.review.reviewers,legacy.reviewers);assert.deepEqual(created.review.points,legacy.points);assert.equal(created.review.applicants.length,0);
  assert.equal(await fs.readFile(path.join(dir,'before-'+(legacy.revision+1)+'.json'),'utf8'),legacyText,'Original file is backed up byte-for-byte before migration');
  let maintenance=await post('/sets/'+id,{revision:0,type:'applicant',name:'Maintenance Applicant',state:'CO',wage:null,licenses:'Maintenance'});assert.equal(maintenance.review.applicants[0].id,'APP-001');
  maintenance=await post('/sets/'+id,{revision:maintenance.review.revision,type:'review',id:'APP-001',slot:0,vote:'No',notes:'Maintenance perspective'});
  assert.equal((await get('/sets/review-original')).review.applicants[0].reviews[0].vote,'Yes');assert.equal(maintenance.review.applicants[0].reviews[0].vote,'No');
  const original=await get('/sets/review-original');
  await Promise.all([post('/sets/'+id,{revision:maintenance.review.revision,type:'applicant',name:'Second Maintenance',state:'',wage:null,licenses:''}),post('/sets/review-original',{revision:original.review.revision,type:'applicant',name:'Second Water',state:'',wage:null,licenses:''})]);
  await post('/sets/'+id,{revision:maintenance.review.revision,type:'delete',id:'APP-001'},409);
  const beforeImport=await get('/sets/review-original'),current=await get('/sets/'+id);
  await post('/sets/'+id,{revision:current.review.revision,type:'import',state:model.blank()});assert.deepEqual((await get('/sets/review-original')).review,beforeImport.review,'Import is scoped to the selected position');
  assert.equal((await get('')).applicants.length,2,'Older clients still see only the original review');
  const storage=sets.validate(JSON.parse(await fs.readFile(path.join(dir,'review.json'),'utf8')));assert.equal(storage.sets.length,2);
  await post('/sets/'+id,{revision:0,type:'create-set',team:'Other',position:'Other'},400);
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),express=require('express');
const model=require('../apps/application-review/model'),sets=require('../apps/application-review/hiring-reviews'),register=require('../application-review-api');
function fixture(complete=true){
  let state=model.blank();state.reviewers=['One','Two','',''];
  for(const name of ['First Applicant','Second Applicant'])state=model.apply(state,{type:'applicant',name,state:'CO',wage:null,licenses:''});
  for(const a of state.applicants)for(const slot of [0,1])if(complete||a.id!=='APP-002'||slot===0)state=model.apply(state,{type:'review',id:a.id,slot,vote:'Yes',notes:'Review'});
  return state;
}
test('interviews require every assigned vote; selection and scheduling preserve application data and contact history',()=>{
  let state=fixture(false);assert.equal(model.interviewsReady(state),false);
  assert.throws(()=>model.apply(state,{type:'interview-selection',ids:['APP-001'],selected:true}),/All assigned reviews/);
  state=model.apply(state,{type:'review',id:'APP-002',slot:1,vote:'No',notes:''});assert.equal(model.interviewsReady(state),true);
  const reviews=structuredClone(state.applicants[0].reviews);
  state=model.apply(state,{type:'interview-selection',ids:['APP-001','APP-002'],selected:true});
  const update=(changes={},contact={})=>{const a=state.applicants[0];state=model.apply(state,{type:'interview',id:a.id,email:a.email,phone:a.phone,interview:{...a.interview,...changes},...contact});};
  update({contactStatus:'called',notes:'First call; no answer'},{email:'candidate@example.com',phone:'303-555-0100 ext 2'});
  update({contactStatus:'voicemail',notes:'Left callback number'});
  update({contactStatus:'reached',response:'accepted',notes:'Confirmed availability'});
  update({date:'2026-11-12',time:'13:30',duration:45,location:'Conference Room'});
  const scheduled=structuredClone(state.applicants[0]);assert.equal(scheduled.interview.history.length,5);assert.equal(scheduled.interview.history[2].summary,'Voicemail Left; Contact notes updated');
  assert.equal(scheduled.email,'candidate@example.com');assert.deepEqual(scheduled.reviews,reviews);assert.equal(scheduled.interview.date,'2026-11-12');
  // Editing old application fields or using bulk edit must not erase scheduling.
  state=model.apply(state,{type:'applicant',id:'APP-001',firstName:'First',lastName:'Applicant',state:'CO',wage:32,licenses:'A'});
  assert.deepEqual(state.applicants[0].interview,scheduled.interview);assert.equal(state.applicants[0].email,scheduled.email);
  const roundtrip=model.validate(JSON.parse(JSON.stringify(state)));assert.deepEqual(roundtrip,state);
  const snapshot=structuredClone(state);assert.throws(()=>model.apply(state,{type:'interview',id:'APP-001',email:'bad',phone:'',interview:state.applicants[0].interview}),/email address/);assert.deepEqual(state,snapshot);
  update({response:'declined',date:'',time:''});assert.equal(state.applicants[0].interview.date,'');assert.ok(state.applicants[0].interview.history.some(e=>e.summary.includes('Scheduled 2026-11-12')));
  state=model.apply(state,{type:'interview-selection',ids:['APP-001'],selected:false});assert.equal(state.applicants[0].interview.selected,false);assert.equal(state.applicants[0].email,'candidate@example.com');
});
test('invalid schedules, partial dates and incomplete selection batches fail atomically',()=>{
  let state=fixture();state=model.apply(state,{type:'interview-selection',ids:['APP-001'],selected:true});
  const before=structuredClone(state),interview={...state.applicants[0].interview,response:'accepted',date:'2026-11-12',time:'09:00'};
  const action={type:'interview',id:'APP-001',email:'',phone:'',interview};
  for(const bad of [{date:'2026-02-30'},{time:'25:00'},{time:''},{date:''},{duration:0},{response:'pending'},{response:'declined'}])assert.throws(()=>model.apply(state,{...action,interview:{...interview,...bad}}));
  assert.throws(()=>model.apply(state,{...action,id:'APP-002'}),/Select the applicant/);
  assert.throws(()=>model.apply(state,{type:'interview-selection',ids:['APP-002','APP-999'],selected:true}),/unavailable/);assert.deepEqual(state,before);
  assert.equal(model.interviewsReady(model.blank()),false);const noReviewers=model.blank();noReviewers.applicants=state.applicants;assert.equal(model.interviewsReady(noReviewers),false);
  const legacy=fixture();delete legacy.applicants[0].interview;delete legacy.applicants[0].email;delete legacy.applicants[0].phone;
  assert.equal(model.validate(legacy).applicants[0].interview.selected,false);
});
test('interview API persists across restart, rejects stale saves, isolates positions and blocks archived writes',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'interview-api-'));let server;
  const start=async()=>{const app=express();app.use(express.json());register(app,{directory});server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});return 'http://127.0.0.1:'+server.address().port;};
  let base=await start();t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(directory,{recursive:true,force:true});});
  const get=async id=>(await(await fetch(base+'/api/application-review/sets/'+id)).json());
  const post=async(id,body,status=200)=>{const r=await fetch(base+'/api/application-review/sets/'+id,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
  let original=await get('review-original');original=await post('review-original',{type:'import',revision:original.review.revision,state:fixture(false)});
  await post('review-original',{type:'interview-selection',revision:original.review.revision,ids:['APP-001'],selected:true},400);
  original=await post('review-original',{type:'review',revision:original.review.revision,id:'APP-002',slot:1,vote:'Maybe',notes:''});
  original=await post('review-original',{type:'interview-selection',revision:original.review.revision,ids:['APP-001'],selected:true});
  const oldRevision=original.review.revision;
  original=await post('review-original',{type:'interview',revision:oldRevision,id:'APP-001',email:'one@example.com',phone:'303-555-0101',interview:{contactStatus:'voicemail',response:'pending',notes:'Callback requested'}});
  await post('review-original',{type:'interview',revision:oldRevision,id:'APP-001',email:'lost@example.com',phone:'',interview:{}},409);
  await new Promise(r=>server.close(r));base=await start();assert.deepEqual((await get('review-original')).review,original.review);
  const create=await fetch(base+'/api/application-review/sets',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({type:'create-set',revision:original.directory.revision,team:'Maintenance',position:'Tech',copyFrom:sets.originalId})});assert.equal(create.status,201);
  const other=await create.json();assert.equal(other.review.applicants.length,0);assert.equal((await get('review-original')).review.applicants[0].email,'one@example.com');
  original=await post('review-original',{type:'archive-set',revision:original.review.revision,archived:true});
  await post('review-original',{type:'interview-selection',revision:original.review.revision,ids:['APP-001'],selected:false},409);
  assert.equal((await get('review-original')).review.applicants[0].interview.selected,true);
});

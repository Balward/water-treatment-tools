(function(root){
'use strict';
const votes=['Yes','Maybe','No'];
const reference=typeof module==='object'&&module.exports?require('./reference-data'):root.ApplicationReviewReference;
const blank=()=>({version:1,revision:0,title:'Application Review',points:{Yes:4,Maybe:1,No:0},reviewers:['','','',''],applicants:[],nextId:1,updatedAt:null});
function text(value,label,max=200,required=false){if(typeof value!=='string'||value.length>max||required&&!value.trim())throw Error('Enter a valid '+label+'.');return value.trim();}
function nameFields(applicant){
  if(applicant.firstName!==undefined||applicant.lastName!==undefined)return {firstName:text(applicant.firstName,'first name',150),lastName:text(applicant.lastName,'last name',150)};
  const name=text(applicant.name,'applicant name',301,true),comma=name.indexOf(',');
  if(comma>0)return {firstName:name.slice(comma+1).trim(),lastName:name.slice(0,comma).trim()};
  const parts=name.split(/\s+/);return {firstName:parts.length>1?parts.slice(0,-1).join(' '):name,lastName:parts.length>1?parts.at(-1):''};
}
function compareLastName(a,b){return a.lastName.localeCompare(b.lastName,'en',{sensitivity:'base'})||a.firstName.localeCompare(b.firstName,'en',{sensitivity:'base'})||a.id.localeCompare(b.id);}
function displayName(applicant){const names=nameFields(applicant);return [names.lastName,names.firstName].filter(Boolean).join(', ');}
const contactStatuses=['not-contacted','called','voicemail','reached'],interviewResponses=['pending','accepted','declined'];
function contactDetails(raw={}){
  const email=text(raw.email??'','email address',254),phone=text(raw.phone??'','phone number',80);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address or leave it blank.');
  return {email,phone};
}
function interviewDetails(raw={}){
  const selected=raw.selected===true,contactStatus=raw.contactStatus??'not-contacted',response=raw.response??'pending';
  if(!contactStatuses.includes(contactStatus)||!interviewResponses.includes(response))throw Error('Choose a valid contact status and interview response.');
  const date=text(raw.date??'','interview date',10),time=text(raw.time??'','interview time',5),duration=raw.duration??60;
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date))throw Error('Choose a valid interview date.');
  if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Choose a valid interview time.');
  if(!Number.isInteger(duration)||duration<5||duration>480)throw Error('Interview duration must be between 5 and 480 minutes.');
  if(Boolean(date)!==Boolean(time))throw Error('Choose both an interview date and time, or leave both blank.');
  if(date&&(!selected||response!=='accepted'))throw Error('Select the applicant and record that they accepted before scheduling an interview.');
  if(!Array.isArray(raw.history??[])||(raw.history??[]).length>1000)throw Error('Interview history must contain no more than 1,000 entries.');
  const history=(raw.history??[]).map(entry=>{if(!Number.isFinite(Date.parse(entry.at)))throw Error('Enter a valid interview history date.');return {at:text(entry.at,'interview history date',40,true),summary:text(entry.summary,'interview history entry',500,true),notes:text(entry.notes??'','interview history notes',2000)};});
  return {selected,contactStatus,response,date,time,duration,location:text(raw.location??'','interview location',300),notes:text(raw.notes??'','contact notes',2000),history};
}
function interviewsReady(state){const rows=summarize(state);return state.reviewers.some(Boolean)&&rows.length>0&&rows.every(a=>a.status==='Complete');}
function validate(raw){
  if(!raw||raw.version!==1||!Array.isArray(raw.reviewers)||raw.reviewers.length!==4||!Array.isArray(raw.applicants)||raw.applicants.length>2000)throw Error('Invalid application review file.');
  const state=blank();state.title=text(raw.title,'review title',240,true);
  state.reviewers=raw.reviewers.map(name=>text(name,'reviewer name',100));
  const names=state.reviewers.filter(Boolean).map(name=>name.toLowerCase());if(new Set(names).size!==names.length)throw Error('Each reviewer must have a different name.');
  for(const vote of votes){const value=raw.points?.[vote];if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000)throw Error('Points must be between 0 and 1,000.');state.points[vote]=value;}
  const ids=new Set();let highest=0;
  state.applicants=raw.applicants.map(a=>{
    if(!/^APP-\d{3,8}$/.test(a.id)||ids.has(a.id))throw Error('Application IDs must be unique and use APP-001 format.');ids.add(a.id);highest=Math.max(highest,Number(a.id.slice(4)));
    if(a.wage!==null&&(typeof a.wage!=='number'||!Number.isFinite(a.wage)||a.wage<0||a.wage>1000000))throw Error('Enter a valid requested wage or leave it blank.');
    const reviews={};for(let slot=0;slot<4;slot++){const review=a.reviews?.[slot];if(!review)continue;if(review.vote!==''&&!votes.includes(review.vote))throw Error('Choose Yes, Maybe, No, or leave the vote blank.');reviews[slot]={vote:review.vote,notes:text(review.notes,'review notes',10000),reviewerName:text(review.reviewerName||state.reviewers[slot],'reviewer name',100),updatedAt:typeof review.updatedAt==='string'?review.updatedAt.slice(0,40):null};}
    const country=a.country===undefined?'US':a.country;
    if(!reference.countryCodes.includes(country))throw Error('Choose a valid country.');
    return {id:a.id,name:text(a.name,'applicant name',301,true),...nameFields(a),country,state:country==='US'?text(a.state,'state',50):'',wage:a.wage,licenses:text(a.licenses,'licenses / certifications',1000),...contactDetails(a),interview:interviewDetails(a.interview),archived:a.archived===true,reviews};
  });
  state.nextId=Math.max(highest+1,Number.isSafeInteger(raw.nextId)?raw.nextId:1);
  state.revision=Number.isSafeInteger(raw.revision)&&raw.revision>=0?raw.revision:0;state.updatedAt=typeof raw.updatedAt==='string'?raw.updatedAt:null;
  return state;
}
function summarize(state){
  const named=state.reviewers.filter(Boolean).length;
  const rows=state.applicants.filter(a=>!a.archived).map(a=>{
    const tally={Yes:0,Maybe:0,No:0};state.reviewers.forEach((name,slot)=>{const r=a.reviews[slot];if(name&&votes.includes(r?.vote))tally[r.vote]++;});
    const count=tally.Yes+tally.Maybe+tally.No,score=count?votes.reduce((sum,v)=>sum+tally[v]*state.points[v],0):null;
    return {...a,tally,count,score,required:named,status:!count?'Not Started':named>0&&count===named?'Complete':'Pending',pending:named-count};
  });
  return rows.map(a=>({...a,rank:a.score===null?null:1+rows.filter(b=>b.score!==null&&b.score>a.score).length}));
}
function apply(current,action,now=new Date().toISOString()){
  const next=JSON.parse(JSON.stringify(current));
  if(action.type==='settings'){
    if(!Array.isArray(action.reviewers)||!action.reviewers.some(name=>typeof name==='string'&&name.trim()))throw Error('Assign at least one reviewer. Leave unused reviewer slots blank.');
    if(action.reviewers?.some((name,i)=>name!==current.reviewers[i]&&current.applicants.some(a=>a.reviews[i]?.vote||a.reviews[i]?.notes)))throw Error('A reviewer with saved reviews cannot be reassigned. Keep that slot tied to its original reviewer.');
    next.title=action.title;next.points=action.points;next.reviewers=action.reviewers;
  }else if(action.type==='bulk-applicants'||action.type==='bulk-edit-applicants'){
    if(!Array.isArray(action.applicants)||!action.applicants.length||action.applicants.length>100)throw Error('Provide between 1 and 100 applicants at a time.');
    const edit=action.type==='bulk-edit-applicants',ids=new Set();
    let draft=next;
    action.applicants.forEach((applicant,i)=>{
      try{
        if(!applicant||typeof applicant!=='object'||Array.isArray(applicant))throw Error('Enter valid applicant details.');
        if(edit){if(typeof applicant.id!=='string'||!current.applicants.some(a=>a.id===applicant.id))throw Error('Applicant not found.');if(ids.has(applicant.id))throw Error('An applicant can only be edited once per batch.');ids.add(applicant.id);}
        draft=apply(draft,{...applicant,type:'applicant',id:edit?applicant.id:undefined},now);
      }catch(error){throw Error('Row '+(i+1)+': '+error.message);}
    });
    Object.assign(next,draft);
  }else if(action.type==='applicant'){
    const existing=next.applicants.find(a=>a.id===action.id);if(action.id&&!existing)throw Error('Applicant not found.');
    const country=action.country??existing?.country??'US';
    const region=country==='US'?text(action.state,'state',50):'';
    if(country==='US'&&region&&!reference.states.some(([code])=>code===region)&&region!==existing?.state)throw Error('Choose a state code from the list.');
    const split=action.firstName!==undefined||action.lastName!==undefined;
    const names=split?{firstName:text(action.firstName,'first name',150,true),lastName:text(action.lastName,'last name',150,true)}:nameFields(action);
    const data={name:split?names.firstName+' '+names.lastName:action.name,...names,country,state:region,wage:action.wage,licenses:action.licenses,...contactDetails({email:action.email??existing?.email,phone:action.phone??existing?.phone})};
    if(existing)Object.assign(existing,data);else next.applicants.push({...data,id:'APP-'+String(next.nextId++).padStart(3,'0'),archived:false,reviews:{}});
  }else if(action.type==='interview-selection'){
    if(!Array.isArray(action.ids)||!action.ids.length||action.ids.length>2000||new Set(action.ids).size!==action.ids.length||typeof action.selected!=='boolean')throw Error('Select valid applicants for the interview list.');
    if(action.selected&&!interviewsReady(current))throw Error('All assigned reviews must be complete before selecting applicants for interviews.');
    for(const id of action.ids){
      const applicant=next.applicants.find(a=>a.id===id&&!a.archived);if(!applicant)throw Error('An applicant is unavailable. Refresh and try again.');
      const before=interviewDetails(applicant.interview);if(before.selected===action.selected)continue;
      applicant.interview=interviewDetails({...before,selected:action.selected,date:action.selected?before.date:'',time:action.selected?before.time:'',history:[...before.history,{at:now,summary:action.selected?'Selected for interview':'Removed from interview list; scheduled time cleared',notes:''}]});
    }
  }else if(action.type==='interview'){
    const applicant=next.applicants.find(a=>a.id===action.id&&!a.archived);if(!applicant)throw Error('Applicant not found.');
    const before=interviewDetails(applicant.interview),details=interviewDetails({...action.interview,selected:before.selected,history:before.history});
    const labels={...Object.fromEntries(contactStatuses.map((value,i)=>[value,['Not Called Yet','Called','Voicemail Left','Reached Applicant'][i]])),...Object.fromEntries(interviewResponses.map((value,i)=>[value,['Awaiting Response','Accepted','Declined'][i]]))};
    const changes=[];
    if(details.contactStatus!==before.contactStatus)changes.push(labels[details.contactStatus]);
    if(details.response!==before.response)changes.push(labels[details.response]);
    if(details.date!==before.date||details.time!==before.time||details.duration!==before.duration||details.location!==before.location)changes.push(details.date?'Scheduled '+details.date+' at '+details.time+' Mountain Time ('+details.duration+' minutes)'+(details.location?' - '+details.location:''):'Schedule cleared / interview details updated');
    if(details.notes!==before.notes)changes.push('Contact notes updated');
    if(changes.length)details.history.push({at:now,summary:changes.join('; '),notes:details.notes});
    applicant.interview=interviewDetails(details);Object.assign(applicant,contactDetails(action));
  }else if(action.type==='delete'){
    if(!next.applicants.some(a=>a.id===action.id))throw Error('Applicant not found.');
    next.applicants=next.applicants.filter(a=>a.id!==action.id);
  }else if(action.type==='archive'){
    const applicant=next.applicants.find(a=>a.id===action.id);if(!applicant)throw Error('Applicant not found.');applicant.archived=action.archived!==false;
  }else if(action.type==='review'){
    const applicant=next.applicants.find(a=>a.id===action.id&&!a.archived),slot=action.slot;
    if(!applicant||!Number.isInteger(slot)||slot<0||slot>3||!next.reviewers[slot])throw Error('Choose an applicant and a named reviewer.');
    applicant.reviews[slot]={vote:action.vote,notes:action.notes,reviewerName:next.reviewers[slot],updatedAt:now};
  }else if(action.type==='import')Object.assign(next,validate(action.state));
  else throw Error('Unknown review action.');
  const checked=validate(next);checked.revision=current.revision+1;checked.updatedAt=now;return checked;
}
function canReveal(applicant,slot){return Number.isInteger(slot)&&slot>=0&&slot<4&&votes.includes(applicant.reviews?.[slot]?.vote);}
function canCompare(state,slot){const active=state.applicants.filter(a=>!a.archived);return active.length>0&&active.every(a=>canReveal(a,slot));}
const api={blank,validate,summarize,apply,votes,canReveal,canCompare,compareLastName,displayName,interviewsReady,contactStatuses,interviewResponses};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ApplicationReview=api;
})(typeof globalThis!=='undefined'?globalThis:this);

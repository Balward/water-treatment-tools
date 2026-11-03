(function(root){
'use strict';
const model=typeof module==='object'&&module.exports?require('./model'):root.ApplicationReview;
const reference=typeof module==='object'&&module.exports?require('./reference-data'):root.ApplicationReviewReference;
const originalId='review-original';
function label(value,name,required=true){if(typeof value!=='string'||value.length>120||required&&!value.trim())throw Error('Enter a valid '+name+'.');return value.trim();}
function validate(raw){
  if(raw?.version===1){const review=model.validate(raw);return {version:2,revision:review.revision,sets:[{id:originalId,team:'',position:'',review}]};}
  if(raw?.version!==2||!Number.isSafeInteger(raw.revision)||raw.revision<0||!Array.isArray(raw.sets)||!raw.sets.length||raw.sets.length>200)throw Error('Invalid hiring review storage.');
  const ids=new Set();
  return {version:2,revision:raw.revision,sets:raw.sets.map(set=>{
    if(typeof set.id!=='string'||!/^review-[a-z0-9-]{1,80}$/.test(set.id)||ids.has(set.id))throw Error('Hiring review IDs must be unique.');ids.add(set.id);
    const team=reference.team(label(set.team,'team',false)),position=label(set.position,'position',false),review=model.validate(set.review);
    const dates=set.month==null&&set.year==null?{month:null,year:null}:reference.period(set.month,set.year);
    if(team&&position&&dates.month)review.title=reference.title(position,team,dates.month,dates.year);
    return {id:set.id,team,position,...dates,archived:set.archived===true,archivedAt:typeof set.archivedAt==='string'?set.archivedAt:null,review};
  })};
}
const blank=()=>validate(model.blank());
function summary(collection){return {revision:collection.revision,sets:collection.sets.map(set=>{
  const rows=model.summarize(set.review);return {id:set.id,team:set.team,position:set.position,month:set.month,year:set.year,archived:set.archived===true,archivedAt:set.archivedAt||null,title:set.review.title,reviewers:set.review.reviewers,applicants:rows.length,complete:rows.filter(a=>a.status==='Complete').length,updatedAt:set.review.updatedAt,revision:set.review.revision};
})};}
function response(collection,id){const set=collection.sets.find(s=>s.id===id);if(!set)throw Error('Hiring review not found.');return {review:set.review,hiringReview:{id:set.id,team:set.team,position:set.position,month:set.month,year:set.year,archived:set.archived===true,archivedAt:set.archivedAt||null},directory:summary(collection)};}
function apply(current,action,now=new Date().toISOString(),newId){
  const next=JSON.parse(JSON.stringify(current));
  if(action.type==='create-set'){
    if(action.revision!==current.revision)throw Object.assign(Error('The hiring review list changed. Refresh and try again.'),{status:409});
    if(next.sets.length>=200)throw Error('The maximum is 200 hiring reviews.');
    const team=reference.team(label(action.team,'team')),position=label(action.position,'position'),review=model.blank();
    if(!reference.teams.includes(team))throw Error('Choose a team from the list.');
    const fallback=reference.currentPeriod(new Date(now)),dates=reference.period(action.month??fallback.month,action.year??fallback.year);
    review.title=reference.title(position,team,dates.month,dates.year);
    if(action.copyFrom){const source=next.sets.find(s=>s.id===action.copyFrom);if(!source)throw Error('The source hiring review no longer exists.');review.reviewers=[...source.review.reviewers];review.points={...source.review.points};}
    review.updatedAt=now;next.sets.push({id:newId,team,position,...dates,review});
  }else{
    const set=next.sets.find(s=>s.id===action.setId);if(!set)throw Object.assign(Error('Hiring review not found.'),{status:404});
    if(action.revision!==set.review.revision)throw Object.assign(Error('Another reviewer saved changes to this hiring review. Your form is preserved. Close it, refresh, and try again.'),{status:409});
    if(action.type==='archive-set'){
      if(typeof action.archived!=='boolean')throw Error('Choose whether to archive or restore this hiring review.');
      set.archived=action.archived;set.archivedAt=action.archived?now:null;set.review.revision++;set.review.updatedAt=now;
      next.revision=current.revision+1;return validate(next);
    }
    if(set.archived)throw Object.assign(Error('This hiring review is archived. Restore it before making changes.'),{status:409});
    if(action.type==='move-applicants'){
      const target=next.sets.find(s=>s.id===action.targetId);
      if(!target||target.id===set.id)throw Error('Choose a different destination review.');
      if(target.archived)throw Error('Restore the destination review before moving applicants into it.');
      if(action.targetRevision!==target.review.revision)throw Object.assign(Error('The destination review changed. Close this window, refresh, and try again.'),{status:409});
      const ids=action.ids;
      if(!Array.isArray(ids)||!ids.length||ids.length>2000||new Set(ids).size!==ids.length)throw Error('Select applicants to move.');
      const moving=ids.map(id=>{const applicant=set.review.applicants.find(a=>a.id===id);if(!applicant)throw Error('A selected applicant no longer exists. Refresh and try again.');return applicant;});
      if(target.review.applicants.length+moving.length>2000)throw Error('The destination review cannot contain more than 2,000 applicants.');
      for(const applicant of moving){
        const reviews={};
        for(const [slot,review] of Object.entries(applicant.reviews)){
          if(!review.vote&&!review.notes)continue;
          const name=review.reviewerName||set.review.reviewers[slot],destination=target.review.reviewers.findIndex(n=>n.trim().toLowerCase()===name.trim().toLowerCase());
          if(!name||destination<0)throw Error('Assign '+(name||'the original reviewer')+' to the destination review before moving applicants with their saved notes or votes.');
          if(reviews[destination])throw Error('Two saved reviews cannot be assigned to the same destination reviewer.');
          reviews[destination]={...review};
        }
        target.review.applicants.push({...applicant,id:'APP-'+String(target.review.nextId++).padStart(3,'0'),reviews});
      }
      set.review.applicants=set.review.applicants.filter(a=>!ids.includes(a.id));
      for(const changed of [set,target]){changed.review.revision++;changed.review.updatedAt=now;}
      next.revision=current.revision+1;return validate(next);
    }
    const changes={...action};
    if(action.type==='settings'){
      if(action.team!==undefined){set.team=reference.team(label(action.team,'team',Boolean(set.team)));if(set.team&&!reference.teams.includes(set.team))throw Error('Choose a team from the list.');}
      if(action.position!==undefined)set.position=label(action.position,'position',Boolean(set.position));
      if(action.month!==undefined||action.year!==undefined)Object.assign(set,reference.period(action.month,action.year));
      if(set.team&&set.position&&set.month)changes.title=reference.title(set.position,set.team,set.month,set.year);
    }
    set.review=model.apply(set.review,changes,now);
    if(set.team&&set.position&&set.month)set.review.title=reference.title(set.position,set.team,set.month,set.year);
  }
  next.revision=current.revision+1;return validate(next);
}
const api={blank,validate,summary,response,apply,originalId};if(typeof module==='object'&&module.exports)module.exports=api;else root.HiringReviews=api;
})(typeof globalThis!=='undefined'?globalThis:this);

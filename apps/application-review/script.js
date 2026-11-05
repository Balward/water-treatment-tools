'use strict';
(()=>{
const $=id=>document.getElementById(id),model=ApplicationReview,key='northglenn-application-review-v1';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>value===null?'Not Provided':value.toLocaleString('en-US',{style:'currency',currency:'USD'});
const stamp=value=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Imported From Workbook';
const hiring=HiringReviews,collectionKey='northglenn-application-review-sets-v2';
const reference=ApplicationReviewReference;
let directory={revision:0,sets:[]},activeSetId='',activeMeta=null;
let state,local=false,busy=false,view='review',selected=null,editing=null,dirty=false,setupDirty=false,slot=0;
let guided=false,queue=[],showPerspectives=false,pendingReviewer='';
const reviewerKey='northglenn-application-review-reviewer';
let managementUnlocked=false,pendingManagementView='dashboard';
let accessManaged=false;
const overviewModeKey='northglenn-application-review-overview-mode';
let detailedOverview=false;try{detailedOverview=localStorage.getItem(overviewModeKey)==='detailed';}catch{}
function setOverviewMode(detailed){
  detailedOverview=detailed;try{localStorage.setItem(overviewModeKey,detailed?'detailed':'simplified');}catch{}
  applyArchiveState();
}
function requestManagement(next='dashboard'){
  if(managementUnlocked)return true;
  pendingManagementView=next;$('management-pin').value='';$('management-pin-error').textContent='';if(!$('management-pin-dialog').open)$('management-pin-dialog').showModal();return false;
}
const selectedApplicants=new Set();let movingApplicants=[];
let bulkMode='add';const bulkOriginal=new Map();
function updateApplicantSelection(){
  const boxes=[...document.querySelectorAll('#applicants [data-select-applicant]')],chosen=boxes.filter(b=>b.checked).length;
  $('select-all-applicants').checked=boxes.length>0&&chosen===boxes.length;$('select-all-applicants').indeterminate=chosen>0&&chosen<boxes.length;
  $('bulk-edit-applicants').textContent=selectedApplicants.size?'Bulk Edit Selected ('+selectedApplicants.size+')':'Bulk Edit Applicants';
  $('move-applicants').hidden=!selectedApplicants.size||activeMeta?.archived||view!=='dashboard';$('move-applicants').textContent='Move Selected Applicants ('+selectedApplicants.size+')';
}
function rememberReviewer(){try{const name=state?.reviewers[reviewerSlot()];if(name)localStorage.setItem(reviewerKey,name);else localStorage.removeItem(reviewerKey);}catch{}}
function message(value,error=false){$('message').textContent=value;$('message').hidden=!value;$('message').classList.toggle('error',error);}
function controls(disabled){busy=disabled;document.querySelectorAll('main button,main input,main select,main textarea,dialog button,dialog input,dialog textarea,dialog select').forEach(button=>button.disabled=disabled);if(!disabled)applyArchiveState();}
function reviewerSlot(){return $('my-reviewer').value===''?null:Number($('my-reviewer').value);}
function canReveal(applicant){return model.canReveal(applicant,reviewerSlot());}
function applyArchiveState(){
  const archived=activeMeta?.archived===true;$('review-archived-notice').hidden=!archived;
  $('add-applicant').hidden=view!=='dashboard'||archived;
  $('bulk-add-applicants').hidden=view!=='dashboard'||archived;
  $('bulk-edit-applicants').hidden=view!=='dashboard'||archived;
  $('vote-form').hidden=view==='overview';
  $('applicants-heading').textContent=view==='overview'?'Candidate Results':'Applicants At A Glance';
  $('new-hiring-review').hidden=!managementUnlocked||!['dashboard','setup','sets'].includes(view);
  $('setup-reminder').hidden=view==='overview'||state.reviewers.some(Boolean);
  document.querySelectorAll('#empty button').forEach(button=>button.hidden=view==='overview');$('empty').querySelector('h3').textContent=view==='overview'?'No Applicants Yet':'Your Next Team Starts Here';$('empty').querySelector('p').textContent=view==='overview'?'There are no applicants in this review.':'Add your first applicant, or import the workbook to continue the existing review.';
  document.querySelectorAll('#setup-form input,#setup-form select,#setup-form button,#vote-form input,#vote-form textarea,#vote-form button,#import,#load-test-applicants,#archived-list button,#applicant-form input,#applicant-form textarea,#applicant-form button[type=submit]').forEach(control=>control.disabled=archived);
  for(const id of ['edit-applicant','archive-applicant','delete-applicant'])$(id).hidden=view!=='dashboard'||archived;
  document.querySelectorAll('#applicants [data-delete]').forEach(control=>control.hidden=archived||view!=='dashboard');
  $('overview-mode').hidden=view!=='overview';
  $('show-reviewer-comments').checked=detailedOverview;
  $('dashboard-view').classList.toggle('overview-simplified',view==='overview'&&!detailedOverview);
  $('dashboard-view').classList.toggle('results-view',view==='overview');
  document.querySelectorAll('#applicants .applicant-notes-row').forEach(row=>row.hidden=view!=='overview'||!detailedOverview);
  document.querySelectorAll('#applicants [data-select-applicant],#select-all-applicants').forEach(control=>{control.disabled=archived||view!=='dashboard';control.hidden=view!=='dashboard';});
  updateApplicantSelection();
  document.querySelectorAll('#bulk-rows tr').forEach(row=>{row.querySelector('[data-field=state]').disabled=archived||row.querySelector('[data-field=country]').value!=='US';});
  document.querySelectorAll('#access-settings-form input,#access-change-passphrase').forEach(control=>control.disabled=busy||!accessManaged);
  $('access-settings-unavailable').hidden=accessManaged;
}
function accessExpired(){ $('access-expired').hidden=false;$('access-signin').href='/application-review-access?next='+encodeURIComponent(location.pathname+location.search); }
async function request(options,route='/api/application-review/sets/'+encodeURIComponent(activeSetId)){const response=await fetch(route,{cache:'no-store',...options});if(response.status===401)accessExpired();if(!response.ok){let data;try{data=await response.json();}catch{}throw Error(data?.error||'Unable to reach shared review storage. Start the API and refresh.');}return response.json();}
function readLocal(){const saved=localStorage.getItem(collectionKey)||localStorage.getItem(key);return saved?hiring.validate(JSON.parse(saved)):hiring.blank();}
function writeLocal(next,current){localStorage.setItem(collectionKey+'-previous',JSON.stringify(current));localStorage.setItem(collectionKey,JSON.stringify(next));}
function accept(payload){
  let previousName=state?.reviewers[reviewerSlot()]||'';if(!state){try{previousName=localStorage.getItem(reviewerKey)||'';}catch{}}
  state=model.validate(payload.review);directory=payload.directory;activeMeta=payload.hiringReview;activeSetId=activeMeta.id;
  for(const id of selectedApplicants)if(!state.applicants.some(a=>a.id===id))selectedApplicants.delete(id);
  pendingReviewer=previousName;
  if(previousName){const match=state.reviewers.indexOf(previousName);$('my-reviewer').value=match>=0?String(match):'';}
  const url=new URL(location.href);url.searchParams.set('hiringReview',activeSetId);history.replaceState(null,'',url);try{localStorage.setItem(collectionKey+'-selected',activeSetId);}catch{}
}
async function save(action){
  if(action.type!=='review'&&!requestManagement())return false;
  if(action.type==='review'&&view==='overview')return false;
  if(busy)return false;controls(true);
  try {
    if(local){const current=readLocal(),next=hiring.apply(current,{...action,setId:activeSetId,revision:state.revision});writeLocal(next,current);accept(hiring.response(next,activeSetId));}
    else accept(await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...action,revision:state.revision})}));
    render();message('Saved successfully.');return true;
  }catch(error){message(error.message,true);const target=$('move-dialog').open?'move-error':$('bulk-dialog').open?'bulk-error':$('review-dialog').open?'review-error':$('applicant-dialog').open?'applicant-error':'setup-error';$(target).textContent=error.message;return false;}
  finally{controls(false);}
}
function badge(row){return `<span class="badge ${row.status==='Complete'?'complete':row.status==='Pending'?'pending':''}">${esc(row.status)}</span>`;}
function votes(row){return canReveal(row)?`<div class="vote-row"><span class="vote-yes">${row.tally.Yes} Yes</span><span class="vote-maybe">${row.tally.Maybe} Maybe</span><span class="vote-no">${row.tally.No} No</span></div>`:'<span class="badge">Vote To View</span>';}
function overviewNotes(applicant){
  if(!canReveal(applicant))return '<p class="overview-notes-hidden">Save your own vote for this applicant to see reviewer notes.</p>';
  return '<div class="applicant-notes-grid" aria-label="Reviewer notes for '+esc(model.displayName(applicant))+'">'+state.reviewers.map((name,slot)=>{
    if(!name)return '';const review=applicant.reviews[slot],vote=review?.vote;
    return `<section class="applicant-note"><header><strong>${esc(name)}</strong><span class="badge ${vote==='Yes'?'vote-yes':vote==='Maybe'?'vote-maybe':vote==='No'?'vote-no':''}">${esc(vote||'Not Reviewed')}</span></header><p class="${review?.notes?'':'no-comment'}">${esc(review?.notes||'No Comment')}</p></section>`;
  }).join('')+'</div>';
}
function render(){
  $('add-applicant').disabled=false;
  $('new-hiring-review').disabled=false;
  renderHiringReviews();
  renderMyReviews();
  document.body.classList.toggle('reviewer-mode',view==='review');
  const canRank=model.canCompare(state,reviewerSlot());$('sort').querySelector('[value=rank]').disabled=!canRank;if(!canRank&&$('sort').value==='rank')$('sort').value='lastName';
  const rows=model.summarize(state),complete=rows.filter(a=>a.status==='Complete').length;
  $('page-title').textContent=state.title;$('last-saved').textContent=state.updatedAt?'Last Saved '+stamp(state.updatedAt):'No Saved Changes Yet';
  $('metrics').innerHTML=[['Applicants',rows.length,'In The Active Candidate Pool','#00677f'],['Reviews Complete',complete,'All Assigned Reviewers Finished','#84bd00'],['Reviews Remaining',rows.reduce((sum,a)=>sum+a.pending,0),'Blank Votes Still To Fill','#f2a900'],['My Reviews',rows.filter(a=>canReveal(a)).length,'Your Saved Recommendations','#62539b']].map(([name,value,note,color])=>`<div class="metric" style="--metric-color:${color}"><span>${name}</span><strong>${value}</strong><small>${note}</small></div>`).join('');
  $('setup-reminder').hidden=state.reviewers.some(Boolean);
  const query=$('search').value.trim().toLowerCase(),filter=$('status-filter').value;
  let list=filter==='archived'?state.applicants.filter(a=>a.archived).map(a=>({...a,score:null,rank:null,count:0,status:'Archived',tally:{Yes:0,Maybe:0,No:0}})):rows.filter(a=>filter==='all'||a.status===filter);
  list=list.filter(a=>[a.id,a.name,model.displayName(a),a.licenses,a.state,reference.location(a)].join(' ').toLowerCase().includes(query));
  list.sort((a,b)=>$('sort').value==='lastName'?model.compareLastName(a,b):$('sort').value==='name'?model.displayName(a).localeCompare(model.displayName(b)):$('sort').value==='id'?a.id.localeCompare(b.id):$('sort').value==='progress'?a.count-b.count||model.displayName(a).localeCompare(model.displayName(b)):(a.rank??Infinity)-(b.rank??Infinity)||model.displayName(a).localeCompare(model.displayName(b)));
  $('applicants').innerHTML=list.map(a=>`<tr class="applicant-summary-row"><td>${canRank?(a.rank??'&#8212;'):'&#8212;'}</td><td><div class="applicant-choice"><input type="checkbox" data-select-applicant="${a.id}" aria-label="Select ${esc(model.displayName(a))}" ${selectedApplicants.has(a.id)?'checked':''}><button class="candidate-name" data-open="${a.id}">${esc(model.displayName(a))}</button></div><small>${a.id} · ${esc(reference.location(a))}</small><small>${esc(a.licenses||'No Certifications Recorded')}</small></td><td>${money(a.wage)}</td><td>${badge(a)}<div class="review-progress" aria-hidden="true">${state.reviewers.filter(Boolean).map((_,i)=>`<i class="${i<a.count?'filled':''}"></i>`).join('')}</div><small>${a.count} Of ${a.required??state.reviewers.filter(Boolean).length} Reviews</small></td><td>${votes(a)}</td><td><span class="score ${canReveal(a)?'':'score-awaiting'}">${canReveal(a)?(a.score??'&#8212;'):'Awaiting Your Review'}</span>${canReveal(a)&&a.score!==null&&a.status!=='Complete'?'<small class="partial-score-label">Partial Points</small>':''}</td><td><button data-open="${a.id}" aria-label="Open ${esc(model.displayName(a))}">Open &rarr;</button> <button class="danger" data-delete="${a.id}" aria-label="Delete ${esc(model.displayName(a))}">Delete</button></td></tr><tr class="applicant-notes-row" hidden><td colspan="7">${overviewNotes(a)}</td></tr>`).join('');
  $('results-count').textContent=`${list.length} Applicant${list.length===1?'':'s'} Shown`;$('empty').hidden=state.applicants.some(a=>!a.archived)||filter==='archived';
  if(!list.length&&$('empty').hidden)$('applicants').innerHTML='<tr><td colspan="7">No applicants match this view.</td></tr>';
  if(!setupDirty)renderSetup();
  applyArchiveState();
}
function reviewerOptions(){return '<option value="">Choose Your Name</option>'+state.reviewers.map((name,i)=>name?`<option value="${i}" ${name?'':'disabled'}>${esc(name||'Reviewer '+(i+1)+' — Not Assigned')}</option>`:'').join('');}
function teamOptions(current=''){return '<option value="">Choose A Team</option>'+reference.teams.map(team=>`<option value="${esc(team)}">${esc(team)}</option>`).join('')+(current&&!reference.teams.includes(current)?`<option value="${esc(current)}">${esc(current)} (Existing Team)</option>`:'');}
function periodFields(prefix,month,year){
  const now=reference.currentPeriod();
  $(prefix+'-month').innerHTML=reference.months.map((name,i)=>`<option value="${i+1}">${name}</option>`).join('');$(prefix+'-month').value=String(month||now.month);
  $(prefix+'-year').innerHTML=Array.from({length:101},(_,i)=>`<option value="${2000+i}">${2000+i}</option>`).join('');$(prefix+'-year').value=String(year||now.year);
}
function updateTitle(prefix){const position=$(prefix+'-position').value.trim(),team=$(prefix+'-team').value;$(prefix==='review'?'review-title':'new-hiring-title').value=position&&team?reference.title(position,team,Number($(prefix+'-month').value),Number($(prefix+'-year').value)):'';}
function updateApplicantCountry(){const us=$('applicant-country').value==='US';$('applicant-state-field').hidden=!us;$('applicant-state').disabled=!us;if(!us)$('applicant-state').value='';}
function renderHiringReviews(){
  $('hiring-review').innerHTML=directory.sets.filter(set=>!set.archived||set.id===activeSetId).map(set=>`<option value="${esc(set.id)}">${set.archived?'Archived / ':''}${esc(set.title)}</option>`).join('');$('hiring-review').value=activeSetId;
  
  $('hiring-review-list').innerHTML=directory.sets.filter(set=>$('show-archived-reviews').checked||!set.archived).map(set=>`<article class="hiring-card"><header><p class="eyebrow">${esc(set.team||'TEAM NOT SET')}</p>${set.archived?'<span class="badge">Archived</span>':set.id===activeSetId?'<span class="badge complete">Selected</span>':''}</header><h3>${esc(set.title)}</h3><p>${esc(set.position||'Add a team and position in Review Setup.')}</p><div class="hiring-counts"><span><strong>${set.applicants}</strong> Applicants</span><span><strong>${set.complete}</strong> Fully Reviewed</span></div><p class="muted">${esc(set.reviewers.filter(Boolean).join(', ')||'Reviewers Not Assigned')}</p><div class="actions"><button type="button" data-set-open="${esc(set.id)}">Open Hiring Review &rarr;</button><button type="button" data-set-archive="${esc(set.id)}" data-restore-set="${set.archived?'true':'false'}">${set.archived?'Restore':'Archive'} Review</button></div></article>`).join('')||'<p class="muted">No active hiring reviews. Select Show Archived Reviews to restore one, or create a new review.</p>';
}
async function archiveHiringReview(id,archived){
  if(!requestManagement('sets'))return;
  if(busy)return;const entry=directory.sets.find(set=>set.id===id);if(!entry)return;
  if(!confirm(`${archived?'Archive':'Restore'} ${entry.title}? ${archived?'Applicants, notes, and votes will be preserved. The review will be read-only until restored.':'The review will be available for editing again.'}${id===activeSetId&&(dirty||setupDirty)?' Unsaved changes will be discarded.':''}`))return;
  controls(true);
  try{
    let payload;
    if(local){const current=readLocal(),next=hiring.apply(current,{type:'archive-set',setId:id,archived,revision:entry.revision});writeLocal(next,current);payload=hiring.response(next,id);}
    else payload=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'archive-set',archived,revision:entry.revision})},'/api/application-review/sets/'+encodeURIComponent(id));
    if(id===activeSetId){dirty=false;setupDirty=false;document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());accept(payload);}else directory=payload.directory;
    if(archived)$('show-archived-reviews').checked=true;render();message(`${archived?'Archived':'Restored'} ${entry.title}.`);
  }catch(error){message(error.message,true);}finally{controls(false);}
}
async function selectHiringReview(id){
  if(busy||id===activeSetId)return;
  if((dirty||setupDirty)&&!confirm('Switch hiring reviews and discard your unsaved changes?')){$('hiring-review').value=activeSetId;return;}
  const previousName=state?.reviewers[$('my-reviewer').value]||'';controls(true);
  try{
    const payload=local?hiring.response(readLocal(),id):await request(undefined,'/api/application-review/sets/'+encodeURIComponent(id));
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());dirty=false;setupDirty=false;selected=null;editing=null;
    $('access-settings-form').reset();
    selectedApplicants.clear();accept(payload);$('search').value='';$('status-filter').value='all';render();
    const match=state.reviewers.indexOf(previousName);$('my-reviewer').value=match>=0?String(match):'';slot=match>=0?match:null;render();
    message('');
  }catch(error){$('hiring-review').value=activeSetId;message(error.message,true);}finally{controls(false);}
}
function openHiringForm(){
  if(!requestManagement('sets'))return;
  if(busy)return;if(setupDirty&&!confirm('Discard unsaved setup changes before creating a hiring review?'))return;setupDirty=false;renderSetup();$('new-hiring-form').reset();$('new-hiring-team').innerHTML=teamOptions();periodFields('new-hiring');updateTitle('new-hiring');$('new-hiring-error').textContent='';dirty=false;$('hiring-dialog').showModal();
}
function renderMyReviews(){
  const previous=pendingReviewer?String(state.reviewers.indexOf(pendingReviewer)):$('my-reviewer').value;pendingReviewer='';$('my-reviewer').innerHTML=reviewerOptions();$('my-reviewer').value=previous;
  const index=$('my-reviewer').value,all=model.summarize(state),mine=all.filter(a=>a.reviews[index]?.vote);
  const named=index!=='';
  $('reviewer-name-field').hidden=named;$('reviewer-identity').hidden=!named;$('reviewer-identity-name').textContent=named?state.reviewers[Number(index)]:'';
  $('my-progress').textContent=named?`You've reviewed ${mine.length} of ${all.length} applicants.`:'Choose your name to see your applicants.';
  $('review-progress-meter').hidden=!named||!all.length;$('review-progress-meter').max=all.length||1;$('review-progress-meter').value=mine.length;
  $('reviewer-instructions').textContent=named?'Review each applicant, choose an interview recommendation, and save. You can return to edit your answers anytime.':'Choose the position and your name above to begin.';
  const remaining=all.length-mine.length;
  $('start-reviews').hidden=activeMeta?.archived||!remaining||index==='';
  $('start-reviews').textContent=`Continue Reviewing (${remaining} Remaining)`;
  $('review-completion').hidden=index===''||!all.length||remaining>0;
  $('view-scores-overview').hidden=!model.canCompare(state,reviewerSlot());
  $('review-completion').textContent='All your reviews are saved. You can edit them below.';
  if(index!==''&&!all.length)$('my-progress').textContent='There are no applicants to review yet.';
  const list=index===''?[]:[...all].sort(model.compareLastName);
  $('my-list').innerHTML=list.map(a=>`<article><div class="my-review-summary"><strong>${esc(model.displayName(a))}</strong><p>${a.id} · ${esc(reference.location(a))} · ${money(a.wage)}</p><p>${esc(a.licenses||'No Certifications Recorded')}</p><span class="badge">${esc(a.reviews[index]?.vote||'Not Reviewed')}</span>${a.reviews[index]?.notes?`<div class="my-review-comment"><span>Your Comments</span><p>${esc(a.reviews[index].notes)}</p></div>`:''}</div><button data-open="${a.id}" data-slot="${index}">${a.reviews[index]?.vote?'Edit My Review':'Review'} &rarr;</button></article>`).join('')||(index!==''?'<p class="notice">There are no applicants to review yet.</p>':'');
}
function renderSetup(){
  $('review-team').innerHTML=teamOptions(activeMeta?.team);$('review-team').value=activeMeta?.team||'';$('review-position').value=activeMeta?.position||'';
  periodFields('review',activeMeta?.month,activeMeta?.year);updateTitle('review');
  $('reviewer-fields').innerHTML=state.reviewers.map((name,i)=>`<label>Reviewer ${i+1}<input data-reviewer="${i}" value="${esc(name)}" maxlength="100" ${state.applicants.some(a=>a.reviews[i]?.vote||a.reviews[i]?.notes)?'readonly':''} placeholder="First And Last Name"></label>`).join('');
  $('point-fields').innerHTML=model.votes.map(v=>`<label>${v} Points<input data-points="${v}" type="number" min="0" max="1000" step="any" required value="${state.points[v]}"></label>`).join('');
  $('archived-list').innerHTML=state.applicants.filter(a=>a.archived).map(a=>`<article><span><strong>${esc(model.displayName(a))}</strong><small> · ${a.id}</small></span><button data-restore="${a.id}" type="button">Restore Applicant</button></article>`).join('')||'<p class="muted">No archived applicants.</p>';
}
function switchView(next){
  if(['dashboard','setup','sets','access'].includes(next)&&!requestManagement(next))return;
  if(view==='access'&&next!=='access'){if(dirty&&!confirm('Discard the unsaved passphrase entries?'))return;dirty=false;$('access-settings-form').reset();}
  if(setupDirty&&next!=='setup'&&!confirm('Leave Review Setup and discard your unsaved changes?'))return;
  if(next!=='setup'){setupDirty=false;renderSetup();}
  view=next;document.body.classList.toggle('reviewer-mode',view==='review');for(const name of ['dashboard','review','setup','guide','sets','access'])$(name+'-view').hidden=name!==view;
  if(view==='overview')$('dashboard-view').hidden=false;
  document.querySelector('.manage-navigation').open=['dashboard','setup','sets','access'].includes(view);
  $('add-applicant').hidden=view!=='dashboard';
  $('new-hiring-review').hidden=view==='review'||view==='guide';
  document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('page-description').textContent={overview:'Compare interview recommendations and total points. Turn on reviewer comments for more detail.',dashboard:'A clear view of every candidate, from first review to interview discussion.',review:'Your assigned perspective. One recommendation at a time.',setup:'Assign reviewers, confirm scoring, and keep a backup of your work.',guide:'The workbook workflow, carried into your Operations workspace.',sets:'Separate applicant pools for each team, position, and hiring round.'}[view];
  $('main').focus({preventScroll:true});window.scrollTo({top:0});
  if(view==='access')$('page-description').textContent='Manage the shared passphrase for Application Review.';
  applyArchiveState();
}
function closeDialog(dialog){if(busy)return;if(dirty&&!confirm('Discard your unsaved changes?'))return;dirty=false;dialog.close();}
function openApplicant(id=null){
  if(!requestManagement())return;
  if(activeMeta?.archived){message('Restore this hiring review before editing applicants.',true);return;}
  if($('review-dialog').open){if(dirty&&!confirm('Discard your unsaved review changes?'))return;$('review-dialog').close();}
  editing=id;const a=state.applicants.find(a=>a.id===id);$('applicant-title').textContent=a?'Edit Applicant · '+a.id:'Add Applicant';
  $('applicant-country').innerHTML=reference.countries.map(([code,name])=>`<option value="${code}">${esc(name)}</option>`).join('');$('applicant-country').value=a?.country||'US';
  $('applicant-state').innerHTML='<option value="">Select State (Optional)</option>'+reference.states.map(([code,name])=>`<option value="${code}">${code} — ${name}</option>`).join('')+(a?.state&&!reference.states.some(([code])=>code===a.state)?`<option value="${esc(a.state)}">${esc(a.state)} (Existing Value)</option>`:'');
  $('applicant-first-name').value=a?.firstName||'';$('applicant-last-name').value=a?.lastName||'';$('applicant-state').value=a?.state||'';$('applicant-wage').value=a?.wage??'';$('applicant-licenses').value=a?.licenses||'';$('applicant-error').textContent='';dirty=false;$('applicant-dialog').showModal();
  updateApplicantCountry();
}
function bulkRowLabels(){
  const rows=[...$('bulk-rows').rows];
  rows.forEach((row,i)=>{row.querySelector('th').textContent=bulkMode==='edit'?row.dataset.applicantId:i+1;row.querySelectorAll('[data-field]').forEach(input=>input.setAttribute('aria-label',input.dataset.field+' for applicant row '+(i+1)));row.querySelector('button').setAttribute('aria-label','Remove applicant row '+(i+1));row.querySelector('button').hidden=bulkMode==='edit';});
  $('bulk-row-count').textContent=rows.length+' Of 100 Rows';$('bulk-add-row').disabled=rows.length>=100;
  $('bulk-row-total').value=rows.length;
}
function addBulkRow(applicant=null){
  if($('bulk-rows').rows.length>=100)return;
  const row=$('bulk-rows').insertRow();
  row.innerHTML='<th scope="row"></th><td><input data-field="firstName" maxlength="150" autocomplete="off"></td><td><input data-field="lastName" maxlength="150" autocomplete="off"></td><td><input data-field="wage" type="number" min="0" max="1000000" step="0.01" inputmode="decimal" placeholder="Optional"></td><td><select data-field="country">'+reference.countries.map(([code,name])=>`<option value="${code}">${esc(name)}</option>`).join('')+'</select></td><td><select data-field="state"><option value="">Optional</option>'+reference.states.map(([code,name])=>`<option value="${code}">${code} - ${esc(name)}</option>`).join('')+'</select></td><td><textarea data-field="licenses" rows="2" maxlength="1000"></textarea></td><td><button type="button" data-remove-bulk>Remove</button></td>';
  row.querySelector('[data-field=country]').value='US';
  if(applicant){
    row.dataset.applicantId=applicant.id;
    if(applicant.state&&!reference.states.some(([code])=>code===applicant.state)){const option=document.createElement('option');option.value=applicant.state;option.textContent=applicant.state+' (Existing Value)';row.querySelector('[data-field=state]').append(option);}
    const values={firstName:applicant.firstName,lastName:applicant.lastName,wage:applicant.wage,country:applicant.country,state:applicant.state,licenses:applicant.licenses};
    row.querySelectorAll('[data-field]').forEach(input=>input.value=values[input.dataset.field]??'');row.querySelector('[data-field=state]').disabled=applicant.country!=='US';bulkOriginal.set(applicant.id,values);
  }
  bulkRowLabels();
}
function configureBulk(mode){
  bulkMode=mode;$('bulk-dialog').querySelector('thead th').textContent=mode==='edit'?'Application ID':'Row';bulkOriginal.clear();$('bulk-rows').replaceChildren();$('bulk-title').textContent=mode==='edit'?'Bulk Edit Applicants':'Bulk Add Applicants';$('bulk-submit').textContent=mode==='edit'?'Save Changes':'Add Applicants';
  $('bulk-description').textContent=mode==='edit'?'Update existing applicant details. IDs, saved votes, notes, and archive status stay attached to each applicant. Only changed rows are saved.':'Enter one applicant per row. First and last names are required; other fields are optional. Blank rows are skipped. Existing applicants and reviews stay in place.';
  document.querySelector('.bulk-row-controls').hidden=mode==='edit';$('bulk-add-row').hidden=mode==='edit';$('bulk-dialog').classList.toggle('bulk-edit-mode',mode==='edit');
}
$('bulk-add-applicants').onclick=()=>{
  if(!requestManagement())return;
  if(busy||activeMeta?.archived)return;
  configureBulk('add');for(let i=0;i<5;i++)addBulkRow();
  $('bulk-context').textContent='Adding To: '+state.title;$('bulk-error').textContent='';dirty=false;$('bulk-dialog').showModal();
};
$('bulk-edit-applicants').onclick=()=>{
  if(!requestManagement()||busy||activeMeta?.archived)return;
  const ids=selectedApplicants.size?[...selectedApplicants]:[...document.querySelectorAll('#applicants [data-select-applicant]')].map(box=>box.dataset.selectApplicant);
  if(!ids.length){message('There are no applicants in this view to edit.',true);return;}
  if(ids.length>100){message('Select up to 100 applicants to edit at a time.',true);return;}
  configureBulk('edit');ids.map(id=>state.applicants.find(a=>a.id===id)).filter(Boolean).sort(model.compareLastName).forEach(a=>addBulkRow(a));
  $('bulk-context').textContent='Editing '+ids.length+' Applicants In: '+state.title;$('bulk-error').textContent='';dirty=false;$('bulk-dialog').showModal();
};
$('bulk-add-row').onclick=()=>{addBulkRow();dirty=true;};
function setBulkRowCount(){
  if(busy||bulkMode==='edit')return;
  const count=Number($('bulk-row-total').value),rows=[...$('bulk-rows').rows];
  if(!Number.isInteger(count)||count<1||count>100){$('bulk-error').textContent='Choose a whole number of rows from 1 to 100.';return;}
  const blank=row=>[...row.querySelectorAll('[data-field]')].every(input=>input.dataset.field==='country'?input.value==='US':!input.value.trim());
  const empty=rows.filter(blank);
  if(count<rows.length-empty.length){$('bulk-error').textContent='There are '+(rows.length-empty.length)+' rows with entered information. Choose at least that many rows, or remove those rows individually.';return;}
  if(count<rows.length)empty.reverse().slice(0,rows.length-count).forEach(row=>row.remove());
  else for(let i=rows.length;i<count;i++)addBulkRow();
  bulkRowLabels();$('bulk-error').textContent='';dirty=true;
}
$('bulk-set-rows').onclick=setBulkRowCount;
$('bulk-row-total').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();setBulkRowCount();}};
$('bulk-rows').onclick=event=>{const button=event.target.closest('[data-remove-bulk]');if(button){button.closest('tr').remove();dirty=true;bulkRowLabels();}};
$('bulk-rows').onchange=event=>{if(event.target.dataset.field==='country'){const select=event.target.closest('tr').querySelector('[data-field=state]');select.value='';select.disabled=event.target.value!=='US';}};
$('bulk-form').onsubmit=async event=>{
  event.preventDefault();if(busy||activeMeta?.archived)return;$('bulk-error').textContent='';
  const applicants=[];let draft=state;
  for(const [i,row] of [...$('bulk-rows').rows].entries()){
    const values=Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value.trim()]));
    if(bulkMode==='add'&&!values.firstName&&!values.lastName&&!values.wage&&!values.state&&!values.licenses&&values.country==='US')continue;
    const applicant={...values,wage:values.wage===''?null:Number(values.wage)};
    if(bulkMode==='edit'){applicant.id=row.dataset.applicantId;const original=bulkOriginal.get(applicant.id);if(Object.keys(original).every(key=>original[key]===applicant[key]))continue;}
    try{draft=model.apply(draft,{...applicant,type:'applicant'});}catch(error){$('bulk-error').textContent='Row '+(i+1)+': '+error.message;row.querySelector('[data-field=firstName]').focus();return;}
    applicants.push(applicant);
  }
  if(!applicants.length){$('bulk-error').textContent=bulkMode==='edit'?'No changes to save.':'Enter at least one applicant before saving.';return;}
  if(await save({type:bulkMode==='edit'?'bulk-edit-applicants':'bulk-applicants',applicants})){dirty=false;$('bulk-dialog').close();message((bulkMode==='edit'?'Updated ':'Added ')+applicants.length+' applicant'+(applicants.length===1?'':'s')+' in '+state.title+'.');}
};
function openReview(id,preferred,fromGuide=false){
  guided=fromGuide;showPerspectives=false;
  selected=id;const a=state.applicants.find(a=>a.id===id);if(!a)return;
  if(a.archived){message('This applicant is archived. Restore them in Review Setup to resume reviews.');return;}
  $('detail-title').textContent=model.displayName(a);$('detail-id').textContent=a.id;
  $('detail-meta').innerHTML=`<h3>Application Details</h3><dl><div><dt>Location</dt><dd>${esc(reference.location(a))}</dd></div><div><dt>Requested Wage</dt><dd>${money(a.wage)}</dd></div><div class="wide"><dt>Licenses / Certifications</dt><dd>${esc(a.licenses||'Not Provided')}</dd></div></dl>`;
  for(const action of ['edit-applicant','archive-applicant','delete-applicant','print-applicant'])$(action).hidden=view!=='dashboard';
  $('review-slot').innerHTML=reviewerOptions();slot=Number.isInteger(preferred)?preferred:reviewerSlot();$('review-slot').value=state.reviewers[slot]?String(slot):'';$('my-reviewer').value=$('review-slot').value;loadReview();
  applyArchiveState();
  $('review-dialog').classList.toggle('guided-review',guided);$('review-dialog').classList.toggle('reviewer-dialog',view==='review');
  $('guided-progress').hidden=!guided;
  const all=state.applicants.filter(a=>!a.archived).sort(model.compareLastName),position=all.findIndex(a=>a.id===id)+1,remaining=all.filter(a=>!model.canReveal(a,reviewerSlot())).length;
  $('guided-progress').textContent=`${state.reviewers[reviewerSlot()]} · Applicant ${position} Of ${all.length} · ${remaining} Remaining`;
  $('save-review').hidden=guided;$('save-next').hidden=!guided;$('skip-applicant').hidden=!guided;
  $('save-next').textContent=remaining===1?'Save & Finish':'Save & Next Applicant';
  dirty=false;if(!$('review-dialog').open)$('review-dialog').showModal();
}
function renderPerspectives(){
  const a=state.applicants.find(a=>a.id===selected),value=$('review-slot').value;
  if(!a)return;
  const reveal=model.canReveal(a,value===''?null:Number(value)),row=model.summarize(state).find(r=>r.id===selected),canRank=model.canCompare(state,value===''?null:Number(value));
  // Totals and ranks also disclose other votes, so withhold them with the badges.
  $('detail-score').hidden=!reveal||(guided&&!showPerspectives);
  $('view-other-reviews').hidden=!reveal;
  $('view-other-reviews').textContent=showPerspectives?'Hide Other Reviews':'View Other Reviews';
  $('view-other-reviews').setAttribute('aria-expanded',String(showPerspectives));
  $('other-perspectives').hidden=!reveal||!showPerspectives;
  $('detail-score').innerHTML=reveal?`<div><strong>${row.score??'—'}</strong><p>${row.status==='Complete'?'Total Points':'Partial Points'} · Rank ${canRank?(row.rank??'&#8212;'):'Hidden'}</p></div><div>${badge(row)}<p>${row.count} Of ${row.required} Reviews</p></div>${votes(row)}`:'';
  $('shared-reviews').innerHTML=(!reveal?'<p class="notice">Other reviewers’ votes are hidden until you save your own vote for this applicant. Notes alone do not reveal votes.</p>':'')+state.reviewers.map((name,i)=>{
    if(!name)return '';const r=a.reviews[i],visible=reveal||String(i)===value,v=visible?r?.vote:undefined;
    return `<article class="shared-review" style="--review-color:${v==='Yes'?'#84bd00':v==='Maybe'?'#f2a900':v==='No'?'#a62d3c':'#9fb3bd'}"><header><strong>${esc(name||'Reviewer '+(i+1)+' — Not Assigned')}</strong><span class="badge ${v==='Yes'?'vote-yes':v==='Maybe'?'vote-maybe':v==='No'?'vote-no':''}">${visible?esc(v||'Not Reviewed'):'Vote Hidden'}</span></header><p class="${visible&&!r?.notes?'no-comment':''}">${visible?esc(r?.notes||'No Comment'):'Notes Hidden Until Your Vote Is Saved'}</p>${r&&visible?`<small>${esc(stamp(r.updatedAt))}${r.reviewerName?' · '+esc(r.reviewerName):''}</small>`:''}</article>`;
  }).join('');
}
function loadReview(){const value=$('review-slot').value,review=state.applicants.find(a=>a.id===selected)?.reviews[value];$('review-notes').value=review?.notes||'';document.querySelectorAll('[name=vote]').forEach(input=>input.checked=input.value===(review?.vote||''));$('review-error').textContent=value===''?'Assign reviewers in Review Setup, then choose your name.':'';dirty=false;renderPerspectives();}
function download(filename,body,type='application/json'){const url=URL.createObjectURL(new Blob([body],{type})),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function backup(){download('application-review-'+activeSetId+'-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({...state,hiringReview:activeMeta},null,2));}
function print(id){
  $('print-content').innerHTML=ApplicationReviewReport.render({...state,hiringReview:activeMeta},id,new Date(),reviewerSlot());
  window.print();
}

document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$('show-reviewer-comments').onchange=()=>setOverviewMode($('show-reviewer-comments').checked);
document.querySelector('.manage-navigation summary').addEventListener('click',event=>{if(!managementUnlocked){event.preventDefault();requestManagement();}});
document.querySelector('.manage-navigation').addEventListener('toggle',event=>{if(!managementUnlocked)event.target.open=false;});
document.querySelectorAll('[data-pin-close]').forEach(button=>button.onclick=()=>$('management-pin-dialog').close());
$('management-pin-form').onsubmit=event=>{
  event.preventDefault();if($('management-pin').value!=='2350'){$('management-pin-error').textContent='Incorrect PIN. Please try again.';$('management-pin').select();return;}
  managementUnlocked=true;$('management-pin').value='';$('management-pin-dialog').close();switchView(pendingManagementView);
};
$('lock-management').onclick=()=>{
  if((dirty||setupDirty)&&!confirm('Discard unsaved changes and lock management?'))return;
  dirty=false;setupDirty=false;managementUnlocked=false;selectedApplicants.clear();document.querySelector('.manage-navigation').open=false;render();switchView('overview');message('Management locked.');
};
$('hiring-review').onchange=()=>selectHiringReview($('hiring-review').value);
$('new-hiring-review').onclick=openHiringForm;
$('hiring-review-list').onclick=async event=>{const archived=event.target.closest('[data-set-archive]');if(archived){await archiveHiringReview(archived.dataset.setArchive,archived.dataset.restoreSet!=='true');return;}const button=event.target.closest('[data-set-open]');if(button){await selectHiringReview(button.dataset.setOpen);if(activeSetId===button.dataset.setOpen)switchView('dashboard');}};
$('show-archived-reviews').onchange=renderHiringReviews;
$('new-hiring-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const action={type:'create-set',team:$('new-hiring-team').value,position:$('new-hiring-position').value,month:Number($('new-hiring-month').value),year:Number($('new-hiring-year').value),copyFrom:$('copy-hiring-reviewers').checked?activeSetId:null};
  controls(true);
  try{
    if(local){const current=readLocal(),next=hiring.apply(current,{...action,revision:current.revision},undefined,'review-'+crypto.randomUUID());writeLocal(next,current);accept(hiring.response(next,next.sets.at(-1).id));}
    else{const latest=await request(undefined,'/api/application-review/sets');accept(await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...action,revision:latest.revision})},'/api/application-review/sets'));}
    dirty=false;setupDirty=false;selected=null;editing=null;slot=0;$('hiring-dialog').close();$('my-reviewer').value='';$('search').value='';$('status-filter').value='all';render();switchView('dashboard');message('Created '+state.title+'. Add applicants to start this hiring review.');
  }catch(error){$('new-hiring-error').textContent=error.message;}finally{controls(false);}
};
document.querySelectorAll('[data-go-setup]').forEach(b=>b.addEventListener('click',()=>switchView('setup')));
$('add-applicant').onclick=()=>openApplicant();document.querySelector('[data-add]').onclick=()=>openApplicant();
for(const id of ['search','status-filter','sort'])$(id).addEventListener('input',()=>{selectedApplicants.clear();if(state)render();});
$('my-reviewer').onchange=()=>{slot=reviewerSlot();rememberReviewer();render();};
$('view-other-reviews').onclick=()=>{showPerspectives=!showPerspectives;renderPerspectives();};
$('change-reviewer').onclick=()=>{$('my-reviewer').value='';slot=null;rememberReviewer();render();$('my-reviewer').focus();};
$('view-scores-overview').onclick=()=>{
  if(!model.canCompare(state,reviewerSlot()))return;
  $('search').value='';$('status-filter').value='all';$('sort').value='rank';
  render();switchView('overview');
};
function finishGuide(){
  guided=false;dirty=false;$('review-dialog').close();render();
  const remaining=model.summarize(state).filter(a=>!model.canReveal(a,reviewerSlot())).length;
  message(remaining?`${remaining} applicant${remaining===1?'':'s'} left to review. Select Continue Reviewing when you are ready.`:'Your reviews are complete. Thank you!');
  (remaining?$('start-reviews'):$('view-scores-overview')).focus();
}
function nextGuided(){
  queue=queue.filter(id=>{const a=state.applicants.find(a=>a.id===id);return a&&!a.archived&&!model.canReveal(a,reviewerSlot());});
  if(queue.length)openReview(queue[0],reviewerSlot(),true);else finishGuide();
}
$('start-reviews').onclick=()=>{if(busy||reviewerSlot()===null||activeMeta?.archived)return;queue=model.summarize(state).filter(a=>!model.canReveal(a,reviewerSlot())).sort(model.compareLastName).map(a=>a.id);nextGuided();};
$('skip-applicant').onclick=()=>{if(busy)return;if(dirty&&!confirm('Skip this applicant and discard your unsaved changes?'))return;queue=queue.filter(id=>id!==selected);dirty=false;nextGuided();};
document.addEventListener('click',event=>{const open=event.target.closest('[data-open]');if(open)openReview(open.dataset.open,open.dataset.slot===undefined?undefined:Number(open.dataset.slot));const close=event.target.closest('[data-close]');if(close)closeDialog(close.closest('dialog'));});
for(const dialog of [$('applicant-dialog'),$('review-dialog'),$('hiring-dialog'),$('bulk-dialog'),$('move-dialog')]){dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});dialog.addEventListener('input',event=>{if(event.target.id!=='review-slot')dirty=true;});}
$('applicant-form').onsubmit=async event=>{event.preventDefault();if(await save({type:'applicant',id:editing,firstName:$('applicant-first-name').value,lastName:$('applicant-last-name').value,country:$('applicant-country').value,state:$('applicant-state').value,wage:$('applicant-wage').value===''?null:Number($('applicant-wage').value),licenses:$('applicant-licenses').value})){dirty=false;$('applicant-dialog').close();}};
$('review-slot').addEventListener('change',()=>{if(dirty&&!confirm('Discard unsaved changes before switching reviewer?')){$('review-slot').value=String(slot);return;}slot=$('review-slot').value===''?null:Number($('review-slot').value);$('my-reviewer').value=$('review-slot').value;rememberReviewer();showPerspectives=false;render();loadReview();});
$('vote-form').onsubmit=async event=>{
  event.preventDefault();if($('review-slot').value===''){$('review-error').textContent='Choose a named reviewer first.';return;}
  const advance=guided&&event.submitter?.id==='save-next',vote=document.querySelector('[name=vote]:checked').value;
  if(advance&&!vote){$('review-error').textContent='Choose Yes, Maybe, or No before continuing. Use Skip For Now to come back later.';return;}
  const wasGuided=guided;
  if(await save({type:'review',id:selected,slot:Number($('review-slot').value),notes:$('review-notes').value,vote})){
    dirty=false;if(advance){queue=queue.filter(id=>id!==selected);nextGuided();}else{openReview(selected,Number($('review-slot').value),wasGuided);$('review-error').textContent='Review Saved.';}
  }
};
$('edit-applicant').onclick=()=>openApplicant(selected);
$('archive-applicant').onclick=async()=>{if(dirty&&!confirm('Discard the unsaved review and continue?'))return;if(!confirm('Archive this applicant? Their reviews and application ID will be preserved.'))return;if(await save({type:'archive',id:selected})){dirty=false;$('review-dialog').close();}};
async function deleteApplicant(id){
  if(busy||view!=='dashboard')return;
  const applicant=state.applicants.find(a=>a.id===id);if(!applicant)return;
  if(!confirm(`Delete ${model.displayName(applicant)} (${applicant.id}) and all their saved notes and votes? This cannot be undone from the applicant list. Use Archive instead to keep their records.`))return;
  if(await save({type:'delete',id})){
    if($('review-dialog').open&&selected===id){dirty=false;$('review-dialog').close();}
    message(`Deleted ${model.displayName(applicant)} (${applicant.id}).`);
  }
}
$('delete-applicant').onclick=()=>deleteApplicant(selected);
$('applicants').addEventListener('click',event=>{const button=event.target.closest('[data-delete]');if(button)deleteApplicant(button.dataset.delete);});
$('applicants').addEventListener('change',event=>{const box=event.target.closest('[data-select-applicant]');if(box){if(box.checked)selectedApplicants.add(box.dataset.selectApplicant);else selectedApplicants.delete(box.dataset.selectApplicant);updateApplicantSelection();}});
$('select-all-applicants').onchange=()=>{document.querySelectorAll('#applicants [data-select-applicant]').forEach(box=>{box.checked=$('select-all-applicants').checked;if(box.checked)selectedApplicants.add(box.dataset.selectApplicant);else selectedApplicants.delete(box.dataset.selectApplicant);});updateApplicantSelection();};
$('move-applicants').onclick=()=>{
  if(!requestManagement())return;
  if(busy||activeMeta?.archived||!selectedApplicants.size)return;
  movingApplicants=[...selectedApplicants];$('move-target').innerHTML='<option value="">Choose A Destination Review</option>'+directory.sets.filter(s=>!s.archived&&s.id!==activeSetId).map(s=>`<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('');
  $('move-summary').textContent='Move '+movingApplicants.length+' applicant'+(movingApplicants.length===1?'':'s')+' from '+state.title+'.';$('move-error').textContent=directory.sets.some(s=>!s.archived&&s.id!==activeSetId)?'':'Create or restore another hiring review before moving applicants.';dirty=false;$('move-dialog').showModal();
};
$('move-form').onsubmit=async event=>{
  event.preventDefault();if(busy||activeMeta?.archived)return;const target=directory.sets.find(s=>s.id===$('move-target').value);if(!target)return;
  if(await save({type:'move-applicants',targetId:target.id,targetRevision:target.revision,ids:movingApplicants})){
    selectedApplicants.clear();dirty=false;$('move-dialog').close();message('Moved '+movingApplicants.length+' applicant'+(movingApplicants.length===1?'':'s')+' to '+target.title+'.');updateApplicantSelection();
  }
};
$('setup-form').oninput=()=>{setupDirty=true;updateTitle('review');};
$('new-hiring-form').addEventListener('input',()=>updateTitle('new-hiring'));
$('applicant-country').onchange=updateApplicantCountry;
$('setup-form').onsubmit=async event=>{event.preventDefault();$('setup-error').textContent='';if(state.applicants.some(a=>Object.values(a.reviews).some(r=>r.vote))&&model.votes.some(v=>Number(document.querySelector('[data-points="'+v+'"]').value)!==state.points[v])&&!confirm('Changing point values recalculates every score and rank. Continue?'))return;const success=await save({type:'settings',title:$('review-title').value,team:$('review-team').value,position:$('review-position').value,month:Number($('review-month').value),year:Number($('review-year').value),reviewers:[...document.querySelectorAll('[data-reviewer]')].map(i=>i.value),points:Object.fromEntries([...document.querySelectorAll('[data-points]')].map(i=>[i.dataset.points,Number(i.value)]))});if(success){setupDirty=false;renderSetup();}};
$('archived-list').onclick=async event=>{const b=event.target.closest('[data-restore]');if(b)await save({type:'archive',id:b.dataset.restore,archived:false});};
$('print').onclick=()=>print();$('print-applicant').onclick=()=>print(selected);$('export').onclick=backup;
$('load-test-applicants').onclick=async()=>{
  if(busy||!state)return;
  if(setupDirty){message('Save Review Setup before loading the test applicants.',true);return;}
  if(!confirm(`Replace all current and archived applicants, notes, and votes in ${state.title} with five dummy applicants? Other hiring reviews will not change. Saved reviewer names and scoring settings will stay the same.`))return;
  if(state.applicants.length)backup();
  if(await save({type:'import',state:ApplicationReviewSamples.create(state)})){
    switchView('dashboard');message('Loaded five test applicants with blank notes and votes. Saved to '+(local?'this browser on this PC.':'shared server storage.'));
  }
};
$('import').onclick=()=>{if(setupDirty&&!confirm('Import will discard your unsaved setup changes. Continue?'))return;$('import-file').click();};
$('import-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('Choose a file smaller than 10 MB.');const imported=file.name.toLowerCase().endsWith('.json')?model.validate(JSON.parse(await file.text())):await readApplicationWorkbook(file);if(!confirm(`Import ${imported.applicants.length} applicants and replace this review? Download a backup first if you need the current review.`))return;if(state.applicants.length)backup();if(await save({type:'import',state:imported})){setupDirty=false;render();message(`Imported ${imported.applicants.length} applicants, with reviews matched by Application ID.`);switchView('dashboard');}}catch(error){message('Import failed: '+error.message,true);}finally{event.target.value='';}};
async function refresh(initial=false){
  if(busy||dirty||setupDirty||document.querySelector('dialog[open]'))return;
  try {
    if(initial){
      const response=await fetch('/api/application-review/sets',{cache:'no-store'});
      if(response.status===401)accessExpired();
      if(response.status===404&&['localhost','127.0.0.1',''].includes(location.hostname))local=true;
      else if(!response.ok)throw Error('Shared hiring review storage is unavailable. Start or update the API and refresh.');
      else {if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Start the API or use Live Server for browser preview.');directory=await response.json();}
    }
    if(local)directory=hiring.summary(readLocal());
    else if(!initial)directory=await request(undefined,'/api/application-review/sets');
    let preferred=activeSetId;
    if(!preferred){preferred=new URL(location.href).searchParams.get('hiringReview');if(!preferred){try{preferred=localStorage.getItem(collectionKey+'-selected');}catch{}}}
    if(preferred&&!directory.sets.some(set=>set.id===preferred))throw Error('This hiring review is unavailable. Choose another hiring review or open the page without its hiringReview link.');
    const id=preferred||(directory.sets.find(set=>!set.archived)||directory.sets[0]).id;
    accept(local?hiring.response(readLocal(),id):await request(undefined,'/api/application-review/sets/'+encodeURIComponent(id)));
    $('storage-mode').hidden=!local;$('storage-mode').textContent=local?'Browser Preview - changes are saved only in this browser, not shared with other reviewers. Download a backup to keep a copy.':'';
    render();if(initial)switchView('review');$('main').dataset.reviewLoaded='true';message('');
  }catch(error){message(error.message,true);if(!state){$('add-applicant').disabled=true;document.querySelectorAll('main section button').forEach(button=>button.disabled=true);}}
}

$('refresh').onclick=()=>refresh();window.addEventListener('beforeunload',event=>{if(dirty||setupDirty||busy){event.preventDefault();event.returnValue='';}});
document.addEventListener('operations:before-navigate',event=>{if(busy||(dirty||setupDirty)&&!confirm('Leave this page and discard your unsaved changes?'))event.preventDefault();});
setInterval(()=>{if(!local&&state&&!document.hidden)refresh();},60000);
$('access-signout').onclick=async()=>{
  if(busy)return;if((dirty||setupDirty)&&!confirm('Discard unsaved changes and sign out?'))return;
  try{const response=await fetch('/application-review-access/logout',{method:'POST'});if(!response.ok)throw Error('Unable to sign out. Try again.');dirty=false;setupDirty=false;location.assign('/application-review-access');}catch(error){message(error.message,true);}
};
fetch('/application-review-access/status',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(status=>{accessManaged=status?.authenticated===true;$('access-signout').hidden=!accessManaged;if(state)applyArchiveState();}).catch(()=>{});
$('access-settings-form').addEventListener('input',()=>{dirty=true;$('access-settings-result').hidden=true;});
$('access-settings-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!accessManaged||!requestManagement('access'))return;
  $('access-settings-error').textContent='';$('access-settings-result').hidden=true;
  const currentPassphrase=$('access-current-passphrase').value,newPassphrase=$('access-new-passphrase').value,confirmPassphrase=$('access-confirm-passphrase').value;
  if(newPassphrase!==confirmPassphrase){$('access-settings-error').textContent='The new passphrase entries did not match.';return;}
  controls(true);
  try{
    const response=await fetch('/application-review-access/passphrase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassphrase,newPassphrase,confirmPassphrase})});
    const data=await response.json();if(response.status===401)accessExpired();if(!response.ok)throw Error(data.error||'Unable to change the passphrase.');
    $('access-settings-form').reset();dirty=false;$('access-settings-result').textContent=data.message;$('access-settings-result').hidden=false;
  }catch(error){$('access-settings-error').textContent=error.message;}finally{controls(false);}
};
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
refresh(true);
})();

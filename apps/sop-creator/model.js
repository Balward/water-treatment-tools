(function(root){
  'use strict';
  const sections=[['purpose','Purpose'],['background','Background'],['notes','Notes'],['safety','Safety Concerns'],['security','Security Concerns'],['equipment','Equipment']];
  const tagGroups=[
    {label:'Treatment Processes',tags:['Raw Water','Coagulation','Flocculation','Sedimentation','Filtration','Backwashing','Disinfection','Clearwells & Storage','Pumping','Residuals Handling']},
    {label:'Instrumentation & Water Quality',tags:['pH','Turbidity','Chlorine','Conductivity','Dissolved Oxygen','ORP','Temperature','Flow','Pressure','Level','Instrumentation']},
    {label:'Chemicals',tags:['Alum','Polymer','Sodium Hypochlorite','Sodium Permanganate','Sodium Hydroxide','Chemical Feed','Chemical Handling']},
    {label:'Tasks',tags:['Calibration','Verification','Sampling','Laboratory Testing','Inspection','Preventive Maintenance','Cleaning','Troubleshooting','Startup','Shutdown']},
    {label:'Systems & Safety',tags:['SCADA','Historian','WIMS','Electrical','Mechanical','Safety','Emergency Response']}
  ];
  const tags=tagGroups.flatMap(group=>group.tags);
  const id=()=>globalThis.crypto.randomUUID();
  function blank(){return {id:id(),revision:0,title:'',team:'Water Treatment',tags:[],effectiveDate:'',preparedBy:'',approvedBy:'',purpose:'',background:'',notes:'',safety:'',security:'',equipment:'',revisionHistory:[],groups:[{id:id(),title:'',steps:[]}]};}
  const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
  const latestDate=dates=>dates.filter(validDate).sort().at(-1)||'';
  function revisedDate(doc){return latestDate((doc.revisionHistory||[]).filter(row=>row.type!=='review').map(row=>row.date));}
  function reviewedDate(doc){return latestDate((doc.revisionHistory||[]).filter(row=>row.type==='review').map(row=>row.date));}
  function reviewStatus(doc,today=new Date()){
    const lastDate=latestDate([doc.effectiveDate,doc.revisedDate,doc.reviewedDate,...(doc.revisionHistory||[]).map(row=>row.date)]);
    if(!lastDate)return {needsReview:true,lastDate:'',dueDate:''};
    const year=Number(lastDate.slice(0,4))+1,month=Number(lastDate.slice(5,7)),day=Math.min(Number(lastDate.slice(8,10)),new Date(Date.UTC(year,month,0)).getUTCDate());
    const dueDate=[year,String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
    const current=typeof today==='string'?today:[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
    return {needsReview:current>dueDate,lastDate,dueDate};
  }
  const step=()=>({id:id(),instruction:'',substeps:[],photos:[],tables:[]});
  const table=()=>({id:id(),caption:'',headers:['Column 1','Column 2'],rows:[['',''],['','']]});
  function validate(input){
    const fail=message=>{throw Error(message);};
    const text=(value,max=20000)=>{if(typeof value!=='string'||value.length>max)fail('An SOP field is missing or too long.');return value;};
    const key=value=>{if(typeof value!=='string'||! /^[a-zA-Z0-9-]{1,80}$/.test(value))fail('Invalid document or step identifier.');return value;};
    if(!input||typeof input!=='object')fail('Choose a valid SOP file.');
    if(!Number.isSafeInteger(input.revision)||input.revision<0)fail('Invalid document revision.');
    const result={id:key(input.id),revision:input.revision};
    const selectedTags=input.tags===undefined?[]:input.tags;
    if(!Array.isArray(selectedTags)||selectedTags.length>20||selectedTags.some(tag=>!tags.includes(tag)))fail('Choose up to 20 tags from the SOP tag list.');
    result.tags=[...new Set(selectedTags)];
    for(const name of ['title','team','effectiveDate','preparedBy','approvedBy',...sections.map(s=>s[0])])result[name]=text(name==='safety'&&input[name]===undefined?'':input[name],sections.some(s=>s[0]===name)?20000:300);
    if(result.effectiveDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(result.effectiveDate)||!Number.isFinite(Date.parse(result.effectiveDate+'T12:00:00Z'))||new Date(result.effectiveDate+'T12:00:00Z').toISOString().slice(0,10)!==result.effectiveDate))fail('Choose a valid effective date.');
    let photoBytes=0,stepCount=0;const ids=new Set([result.id]);
    const unique=value=>{key(value);if(ids.has(value))fail('Duplicate step or photo identifier.');ids.add(value);return value;};
    const revisions=input.revisionHistory===undefined?[]:input.revisionHistory;
    if(!Array.isArray(revisions)||revisions.length>100)fail('Use up to 100 revision entries per SOP.');
    result.revisionHistory=revisions.map(row=>{
      if(!row||typeof row!=='object')fail('Invalid revision entry.');
      const next={id:unique(row.id)};
      if(row.type!==undefined){if(!['revision','review','creation'].includes(row.type))fail('Choose Revision or Review, or Creation for the history entry.');next.type=row.type;}
      for(const key of ['date','summary','revisedBy','approvedBy'])next[key]=text(row[key],key==='summary'?2000:300);
      if(next.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(next.date)||!Number.isFinite(Date.parse(next.date+'T12:00:00Z'))||new Date(next.date+'T12:00:00Z').toISOString().slice(0,10)!==next.date))fail('Choose a valid revision effective date.');
      if(next.type==='creation'&&!next.summary.trim())next.summary='SOP Created';
      return next;
    });
    if(!Array.isArray(input.groups)||input.groups.length>30)fail('Use up to 30 procedure sections.');
    result.groups=input.groups.map(group=>{
      if(!group||!Array.isArray(group.steps))fail('Invalid procedure section.');
      return {id:unique(group.id),title:text(group.title,300),steps:group.steps.map(item=>{
        if(++stepCount>200)fail('Use up to 200 steps per SOP.');
        if(!item||!Array.isArray(item.substeps)||item.substeps.length>26||!Array.isArray(item.photos)||item.photos.length>8)fail('Use up to 26 substeps and 8 photos per step.');
        // Retain older step titles as ordinary instruction text when opening a saved SOP or backup.
        const oldTitle=item.title===undefined?'':text(item.title,300);
        const instruction=text([oldTitle,text(item.instruction,20302)].filter(value=>value.trim()).join('\n\n'),20302);
        const tables=item.tables===undefined?[]:item.tables;
        if(!Array.isArray(tables)||tables.length>6)fail('Use up to 6 tables per step.');
        const validatedTables=tables.map(table=>{
          if(!table||!Array.isArray(table.headers)||table.headers.length<1||table.headers.length>8||!Array.isArray(table.rows)||table.rows.length<1||table.rows.length>50)fail('Tables need 1–8 columns and 1–50 rows.');
          return {id:unique(table.id),caption:text(table.caption,300),headers:table.headers.map(value=>text(value,2000)),rows:table.rows.map(row=>{
            if(!Array.isArray(row)||row.length!==table.headers.length)fail('Every table row must match its column count.');
            return row.map(value=>text(value,2000));
          })};
        });
        return {id:unique(item.id),instruction,tables:validatedTables,substeps:item.substeps.map(sub=>({id:unique(sub.id),text:text(sub.text)})),photos:item.photos.map(photo=>{
          const data=text(photo.data,3000000);photoBytes+=data.length;
          if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(data))fail('Photos must be PNG, JPEG, or WebP images.');
          if(photoBytes>12000000)fail('Photos are too large for one SOP. Use fewer or smaller photos.');
          if(photo.scale!==undefined&&(!Number.isInteger(photo.scale)||photo.scale<25||photo.scale>200))fail('Photo size must be between 25% and 200%.');
          return {id:unique(photo.id),data,caption:text(photo.caption,1000),...(photo.scale===undefined?{}:{scale:photo.scale})};
        })};
      })};
    });
    return result;
  }
  const api={sections,tagGroups,tags,blank,step,table,revisedDate,reviewedDate,reviewStatus,validate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SOPModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);

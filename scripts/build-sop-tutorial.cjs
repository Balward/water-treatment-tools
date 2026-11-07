/* Capture the real creator against disposable local storage, then record a captioned WebM. */
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),express=require('express');
const {launchBrowser,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
const output=path.resolve('apps/sop-creator/tutorial-assets');
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sop-tutorial-')),app=express();let b;
  await fs.mkdir(output,{recursive:true});app.use(express.json({limit:'16mb'}));require('../sop-api')(app,{directory});
  app.post('/tutorial-video',express.raw({type:'video/webm',limit:'100mb'}),async(req,res)=>{await fs.writeFile(path.join(output,'sop-creator-walkthrough.webm'),req.body);res.sendStatus(204);});
  const music=process.argv[2]||process.env.SOP_TUTORIAL_MUSIC;if(!music)throw Error('Pass the tutorial music MP3 path as the first argument.');
  app.get('/tutorial-music',(_req,res)=>res.sendFile(path.resolve(music)));
  app.get('/tutorial-recorder.js',(_req,res)=>res.sendFile(path.resolve('scripts/sop-tutorial-recorder.js')));
  app.get('/sop-creator/tutorial-recorder.html',(_req,res)=>res.type('html').send('<!doctype html><canvas width="1280" height="1080"></canvas><script src="/tutorial-recorder.js"></script>'));
  app.use('/sop-creator',express.static(path.resolve('apps/sop-creator')));app.use('/shared',express.static(path.resolve('shared')));app.use('/assets',express.static(path.resolve('assets')));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port,steps=[];
  try{
    b=await launchBrowser({acceptDialogs:true,userGesture:true});const {evaluate,call}=b;
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    const until=async expression=>{for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+expression);};
    const input=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const click=async selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    async function capture(title,text,selector,pointSelector=selector){
      await evaluate(`(()=>{document.getElementById('tutorial-highlight')?.remove();document.getElementById('tutorial-marker')?.remove();const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',inline:'nearest'});})()`);
      await new Promise(r=>setTimeout(r,180));await evaluate('document.fonts.ready');
      const point=await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)}),r=element.getBoundingClientRect();let left=Math.max(6,r.left),top=Math.max(6,r.top),right=Math.min(innerWidth-6,r.right),bottom=Math.min(innerHeight-6,r.bottom);for(let p=element.parentElement;p;p=p.parentElement){if(/auto|scroll|hidden/.test(getComputedStyle(p).overflowY)){const b=p.getBoundingClientRect();left=Math.max(left,b.left);top=Math.max(top,b.top);right=Math.min(right,b.right);bottom=Math.min(bottom,b.bottom);}}const h=document.createElement('div');h.id='tutorial-highlight';Object.assign(h.style,{position:'fixed',left:(left-3)+'px',top:(top-3)+'px',width:(right-left+6)+'px',height:(bottom-top+6)+'px',border:'6px solid #0969da',borderRadius:'8px',boxShadow:'0 0 0 3px #fff,0 0 0 6px #0969da55',pointerEvents:'none',zIndex:9999});document.body.append(h);const target=document.querySelector(${JSON.stringify(pointSelector)}).getBoundingClientRect(),x=Math.max(42,Math.min(innerWidth-48,target.left+target.width/2)),y=Math.max(42,Math.min(innerHeight-70,target.top+target.height/2));const dot=document.createElement('div');dot.textContent=${steps.length+1};Object.assign(dot.style,{position:'fixed',left:(x-19)+'px',top:(y-19)+'px',width:'38px',height:'38px',display:'grid',placeItems:'center',border:'3px solid white',borderRadius:'50%',background:'#d84800',color:'white',font:'bold 18px sans-serif',boxShadow:'0 0 0 3px #d84800',pointerEvents:'none',zIndex:10000});dot.id='tutorial-marker';document.body.append(dot);return {x,y};})()`);
      const shot=await call('Page.captureScreenshot',{format:'png'}),image='step-'+String(steps.length+1).padStart(2,'0')+'.png';await fs.writeFile(path.join(output,image),Buffer.from(shot.data,'base64'));
      steps.push({title,text,image,point,duration:16,start:steps.length*16});console.log('Captured '+steps.length+': '+title);
    }
    await call('Page.navigate',{url:base+'/sop-creator/library.html'});await until('document.getElementById("library-status").textContent===""');
    await capture('Start From the SOP Library','Select + New SOP to start a procedure. Existing procedures use Edit SOP or View SOP.','.toolbar-actions .primary');
    await click('.toolbar-actions .primary');await until('!!document.querySelector("[data-meta=title]")&&!document.querySelector("main").inert');
    await input('[data-meta=title]','Training Example — Routine Equipment Check');
    await capture('Name the Procedure','Enter an Equipment or Process — Task title. Select the responsible team and enter an effective date when applicable.','[data-meta=title]');
    await evaluate('document.querySelector(".tag-picker").open=true');
    await evaluate('(()=>{const c=[...document.querySelectorAll("[data-sop-tag]")].find(e=>e.dataset.sopTag==="Inspection");c.checked=true;c.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await input('#tag-search','Inspection');
    await capture('Choose Searchable Tags','Open Choose Tags and select relevant topics. Tags help operators find procedures in the library.','.tag-option:has([data-sop-tag="Inspection"])');
    await input('[data-meta=purpose]','Describe the workflow for documenting a routine equipment check. Training example only.');
    await input('[data-meta=background]','Use the creator fields to build a consistent document. This sample is not an operating procedure.');
    await input('[data-meta=equipment]','Current equipment instructions\nApproved inspection checklist');
    await capture('Add Context and Preparation','Use Purpose for the goal, Background for useful context, and separate fields for equipment, safety, security, and notes. Leave unused fields empty.','[data-meta=purpose]');
    await input('[data-group-title]','Preparation');await click('[data-action=add-step]');
    await input('[data-step-instruction]','Review the current equipment instructions and approved checklist.');
    await capture('Organize Sections and Steps','Name the phase, then add a numbered step. Write one main action per step. The creator handles numbering.','[data-step-instruction]');
    await click('[data-action=add-substep]');await input('[data-substep]','Confirm that the checklist applies to the equipment being inspected.');
    await capture('Add Supporting Substeps','Use Add Substep for smaller actions belonging to the parent task. Enter starts the next item; Shift+Enter adds a line break.','[data-substep]');
    await click('[data-action=add-table]');await input('[data-table-caption]','Example Checklist References');await input('[data-table-row="-1"][data-table-column="0"]','Reference');await input('[data-table-row="-1"][data-table-column="1"]','Location');await input('[data-table-row="0"][data-table-column="0"]','Equipment instructions');await input('[data-table-row="0"][data-table-column="1"]','Approved document library');
    await capture('Use a Table for Repeated Information','Select Add Table. Edit headings and cells directly, and use the row and column controls as needed.','.table-editor','[data-table-row="-1"][data-table-column="0"]');
    await evaluate(`(()=>{const c=document.createElement('canvas');c.width=640;c.height=300;const x=c.getContext('2d');x.fillStyle='#edf5f7';x.fillRect(0,0,640,300);x.fillStyle='#00677f';x.font='bold 32px sans-serif';x.fillText('TRAINING EXAMPLE',130,100);x.font='24px sans-serif';x.fillText('Attach a useful equipment photo here',115,165);return new Promise(resolve=>c.toBlob(blob=>{const t=new DataTransfer();t.items.add(new File([blob],'training-example.png',{type:'image/png'}));const e=document.querySelector('[data-photo]');e.files=t.files;e.dispatchEvent(new Event('change',{bubbles:true}));resolve();}));})()`);
    await until('!!document.querySelector("[data-caption]")');await input('[data-caption]','Training illustration — replace with a relevant equipment photo.');
    await capture('Attach a Photo and Caption','Use Add Photo on the relevant step. Add a caption explaining what the image shows. Multiple photos are arranged automatically.','.photo-editor','[data-caption]');
    await evaluate('document.querySelector("#sop-document h1").click()');
    await capture('Edit Through the Live Preview','Click highlighted text in Live Preview to jump to its entry field. Drag the center divider to resize; use the pop-out icon for a separate window.','#sop-document h1');
    await click('#add-revision');await input('[data-revision-field=type]','creation');await input('[data-revision-field=date]','2026-11-07');await input('[data-revision-field=revisedBy]','Training Example');
    await capture('Record Creation, Revisions, and Reviews','Choose the history entry type, date, and person. Creation starts with SOP Created. Record an approver only after approval occurs.','.revision-entry','[data-revision-field=type]');
    await evaluate('document.getElementById("editor").scrollTop=0;document.getElementById("preview").scrollTop=0;window.scrollTo(0,0)');
    await capture('Save the SOP','Select Save SOP to store the document in the library. A browser draft is a recovery copy, not a saved library SOP.','#save-button');
    await click('#save-button');await until('document.getElementById("save-status").textContent==="Saved"');await click('#library-button');await until('location.pathname.endsWith("/library.html")&&!!document.querySelector(".entry .actions")');
    await capture('View or Edit the Saved Procedure','Use View SOP for the saved read-only document and Print / Save PDF. Use the pencil to edit. This walkthrough saved only to isolated training storage.','.entry .actions');
    await fs.writeFile(path.join(output,'steps.json'),JSON.stringify(steps,null,2));
    await call('Page.navigate',{url:base+'/sop-creator/tutorial-recorder.html'});
    // Recorder page is served from a temporary in-memory route below.
    await until('window.recorderReady===true');await evaluate('window.startTutorialRecording()');
    for(let i=0;i<280;i++){const status=await evaluate('window.recordingStatus');if(status==='done')break;if(status?.startsWith('error:'))throw Error(status);if(i===279)throw Error('Video recording timed out');if(i%30===0)console.log('Rendering video: '+i+' seconds elapsed');await new Promise(r=>setTimeout(r,1000));}
    console.log('Created '+steps.length+' screenshots and '+steps.length*16+'-second captioned WebM with music.');
  }finally{await b?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await removeTemporaryDirectory(directory);}
})().catch(error=>{console.error(error);process.exitCode=1});

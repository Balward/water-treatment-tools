/* Capture the real creator against disposable local storage, then record a captioned WebM. */
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),express=require('express');
const {launchBrowser,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
const output=path.resolve('apps/sop-creator/tutorial-assets');
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sop-tutorial-')),app=express();let b;
  await fs.mkdir(output,{recursive:true});app.use(express.json({limit:'16mb'}));require('../sop-api')(app,{directory});
  app.post('/tutorial-video',express.raw({type:'video/webm',limit:'100mb'}),async(req,res)=>{await fs.writeFile(path.join(output,'sop-creator-walkthrough.webm'),req.body);res.sendStatus(204);});
  app.get('/sop-creator/tutorial-recorder.html',(_req,res)=>res.type('html').send(`<!doctype html><canvas width="1280" height="920"></canvas><script>
  window.recordingStatus='ready';window.recorderReady=true;
  window.startTutorialRecording=()=>{(async()=>{try{
    const steps=await(await fetch('./tutorial-assets/steps.json')).json(),images=await Promise.all(steps.map(s=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='./tutorial-assets/'+s.image;})));
    const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),stream=canvas.captureStream(24),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm;codecs=vp8',recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1600000}),chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{const response=await fetch('/tutorial-video',{method:'POST',headers:{'Content-Type':'video/webm'},body:new Blob(chunks,{type:'video/webm'})});stream.getTracks().forEach(t=>t.stop());window.recordingStatus=response.ok?'done':'error:Upload failed';};
    function wrap(text,x,y,maxWidth,lineHeight){let line='';for(const word of text.split(' ')){const next=line+word+' ';if(ctx.measureText(next).width>maxWidth){ctx.fillText(line,x,y);line=word+' ';y+=lineHeight;}else line=next;}ctx.fillText(line,x,y);}
    const started=performance.now();recorder.start(1000);window.recordingStatus='recording';
    function frame(){const elapsed=(performance.now()-started)/1000,index=Math.min(steps.length-1,Math.floor(elapsed/8)),step=steps[index];ctx.fillStyle='#edf2f4';ctx.fillRect(0,0,1280,920);ctx.drawImage(images[index],0,0,1280,800);const scale=1280/1440,phase=elapsed%8;ctx.beginPath();ctx.arc(step.point.x*scale,step.point.y*scale,12+Math.sin(phase*3)*3,0,Math.PI*2);ctx.strokeStyle='#0969da';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#172127';ctx.fillRect(0,800,1280,120);ctx.fillStyle='#fff';ctx.font='bold 22px sans-serif';ctx.fillText((index+1)+' / '+steps.length+'   '+step.title,28,832);ctx.font='18px sans-serif';wrap(step.text,28,862,1220,24);ctx.fillStyle='#24a9c4';ctx.fillRect(0,916,1280*Math.min(1,elapsed/(steps.length*8)),4);if(elapsed<steps.length*8)requestAnimationFrame(frame);else recorder.stop();}frame();
  }catch(error){window.recordingStatus='error:'+error.message;}})();};
  </script>`));
  app.use('/sop-creator',express.static(path.resolve('apps/sop-creator')));app.use('/shared',express.static(path.resolve('shared')));app.use('/assets',express.static(path.resolve('assets')));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port,steps=[];
  try{
    b=await launchBrowser({acceptDialogs:true,userGesture:true});const {evaluate,call}=b;
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    const until=async expression=>{for(let i=0;i<150;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+expression);};
    const input=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const click=async selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    async function capture(title,text,selector){
      await evaluate(`(()=>{document.getElementById('tutorial-highlight')?.remove();const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',inline:'nearest'});})()`);
      await new Promise(r=>setTimeout(r,180));await evaluate('document.fonts.ready');
      const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(),h=document.createElement('div');h.id='tutorial-highlight';Object.assign(h.style,{position:'fixed',left:(r.left-4)+'px',top:(r.top-4)+'px',width:(r.width+8)+'px',height:(r.height+8)+'px',border:'3px solid #0969da',borderRadius:'8px',boxShadow:'0 0 0 4px #ffffffb0',pointerEvents:'none',zIndex:9999});document.body.append(h);return {x:Math.min(1420,r.right-8),y:Math.min(880,Math.max(10,r.top+16))};})()`);
      const shot=await call('Page.captureScreenshot',{format:'png'}),image='step-'+String(steps.length+1).padStart(2,'0')+'.png';await fs.writeFile(path.join(output,image),Buffer.from(shot.data,'base64'));
      steps.push({title,text,image,point,start:steps.length*8});console.log('Captured '+steps.length+': '+title);
    }
    await call('Page.navigate',{url:base+'/sop-creator/library.html'});await until('document.getElementById("library-status").textContent===""');
    await capture('Start From the SOP Library','Select + New SOP to start a procedure. Existing procedures use Edit SOP or View SOP.','.toolbar-actions .primary');
    await click('.toolbar-actions .primary');await until('!!document.querySelector("[data-meta=title]")&&!document.querySelector("main").inert');
    await input('[data-meta=title]','Training Example — Routine Equipment Check');
    await capture('Name the Procedure','Enter an Equipment or Process — Task title. Select the responsible team and enter an effective date when applicable.','[data-meta=title]');
    await evaluate('document.querySelector(".tag-picker").open=true');
    await evaluate('(()=>{const c=[...document.querySelectorAll("[data-sop-tag]")].find(e=>e.dataset.sopTag==="Inspection");c.checked=true;c.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await capture('Choose Searchable Tags','Open Choose Tags and select relevant topics. Tags help operators find procedures in the library.','.tag-picker');
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
    await capture('Use a Table for Repeated Information','Select Add Table. Edit headings and cells directly, and use the row and column controls as needed.','.table-editor');
    await evaluate(`(()=>{const c=document.createElement('canvas');c.width=640;c.height=300;const x=c.getContext('2d');x.fillStyle='#edf5f7';x.fillRect(0,0,640,300);x.fillStyle='#00677f';x.font='bold 32px sans-serif';x.fillText('TRAINING EXAMPLE',130,100);x.font='24px sans-serif';x.fillText('Attach a useful equipment photo here',115,165);return new Promise(resolve=>c.toBlob(blob=>{const t=new DataTransfer();t.items.add(new File([blob],'training-example.png',{type:'image/png'}));const e=document.querySelector('[data-photo]');e.files=t.files;e.dispatchEvent(new Event('change',{bubbles:true}));resolve();}));})()`);
    await until('!!document.querySelector("[data-caption]")');await input('[data-caption]','Training illustration — replace with a relevant equipment photo.');
    await capture('Attach a Photo and Caption','Use Add Photo on the relevant step. Add a caption explaining what the image shows. Multiple photos are arranged automatically.','.photo-editor');
    await evaluate('document.querySelector("#sop-document h1").click()');
    await capture('Edit Through the Live Preview','Click highlighted text in Live Preview to jump to its entry field. Drag the center divider to resize; use the pop-out icon for a separate window.','#sop-document h1');
    await click('#add-revision');await input('[data-revision-field=type]','creation');await input('[data-revision-field=date]','2026-11-07');await input('[data-revision-field=revisedBy]','Training Example');
    await capture('Record Creation, Revisions, and Reviews','Choose the history entry type, date, and person. Creation starts with SOP Created. Record an approver only after approval occurs.','.revision-entry');
    await evaluate('document.getElementById("editor").scrollTop=0;document.getElementById("preview").scrollTop=0;window.scrollTo(0,0)');
    await capture('Save the SOP','Select Save SOP to store the document in the library. A browser draft is a recovery copy, not a saved library SOP.','#save-button');
    await click('#save-button');await until('document.getElementById("save-status").textContent==="Saved"');await click('#library-button');await until('location.pathname.endsWith("/library.html")&&!!document.querySelector(".entry .actions")');
    await capture('View or Edit the Saved Procedure','Use View SOP for the saved read-only document and Print / Save PDF. Use the pencil to edit. This walkthrough saved only to isolated training storage.','.entry .actions');
    await fs.writeFile(path.join(output,'steps.json'),JSON.stringify(steps,null,2));
    await call('Page.navigate',{url:base+'/sop-creator/tutorial-recorder.html'});
    // Recorder page is served from a temporary in-memory route below.
    await until('window.recorderReady===true');await evaluate('window.startTutorialRecording()');
    for(let i=0;i<150;i++){const status=await evaluate('window.recordingStatus');if(status==='done')break;if(status?.startsWith('error:'))throw Error(status);if(i===149)throw Error('Video recording timed out');await new Promise(r=>setTimeout(r,1000));}
    console.log('Created '+steps.length+' screenshots and '+steps.length*8+'-second captioned WebM.');
  }finally{await b?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await removeTemporaryDirectory(directory);}
})().catch(error=>{console.error(error);process.exitCode=1});

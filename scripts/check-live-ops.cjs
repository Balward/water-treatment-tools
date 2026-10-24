// Exercise the real API against temporary data, never the production data file.
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const {spawn} = require('child_process');
const assert = require('node:assert/strict');
const {launchBrowser,removeTemporaryDirectory}=require('./lib/browser-check.cjs');
const root = path.resolve(__dirname, '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'live-ops-check-'));
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/live-ops-state.json'), 'utf8'));
  fixture.updatedAt = new Date().toISOString();
  fixture.equipment[7].updatedAt = fixture.updatedAt;
  fs.writeFileSync(path.join(temp, 'live-ops-state.json'), JSON.stringify(fixture));
  const api = spawn(process.execPath, [path.join(root, 'claude-proxy-server.js')], {
    cwd:root, env:{...process.env,PORT:'3191',LIVE_OPS_DATA_DIR:temp,CLAUDE_API_KEY:'test',OPENAI_API_KEY:'test'}, windowsHide:true, stdio:'ignore'
  });
  let browser, server, refuseStream = false, refuseState = false, dropStreamData = false, streamConnections = 0;
  const streamResponses = new Set();
  try {
    for (let i=0;i<80;i++) { try { if ((await fetch('http://127.0.0.1:3191/health')).ok) break; } catch {} await wait(100); }
    assert.ok((await fetch('http://127.0.0.1:3191/health')).ok);
    for(let i=0;i<3;i++)assert.ok((await fetch('http://127.0.0.1:3191/api/live-ops/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Layout check '+i+': Review the equipment notes and follow up on maintenance items before the next shift.',pinned:i===0,updatedBy:'Layout test'})})).ok);
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'};
    server=http.createServer((req,res)=>{
      if(req.url.startsWith('/api/')){
        if(refuseState && req.url.startsWith('/api/live-ops/state')){res.writeHead(503);res.end();return;}
        if(req.url.startsWith('/api/live-ops/stream')) {
          if(refuseStream){res.writeHead(503);res.end();return;}
          streamConnections++;streamResponses.add(res);res.on('close',()=>streamResponses.delete(res));
        }
        const proxy=http.request({hostname:'127.0.0.1',port:3191,path:req.url,method:req.method,headers:req.headers},response=>{res.writeHead(response.statusCode,response.headers);if(req.url.startsWith("/api/live-ops/stream")){response.on("data",chunk=>{if(!dropStreamData&&!res.destroyed)res.write(chunk)});response.on("end",()=>res.end());}else response.pipe(res)});
        proxy.on('error',()=>{if(res.destroyed||res.writableEnded)return;if(!res.headersSent)res.writeHead(502);res.end()});req.pipe(proxy);res.on('close',()=>proxy.destroy());return;
      }
      let pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname.startsWith('/live-operations-dashboard/'))pathname='/apps'+pathname;
      if(pathname.endsWith('/'))pathname+='index.html';
      const file=path.resolve(root,'.'+decodeURIComponent(pathname));
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      fs.readFile(file,(error,body)=>{res.writeHead(error?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(error?'Not found':body)});
    });
    await new Promise(resolve=>server.listen(8781,'127.0.0.1',resolve));
    browser=await launchBrowser({acceptDialogs:true,userGesture:true});
    const {call,evaluate,errors}=browser;
    await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
    await call('Page.navigate',{url:'http://127.0.0.1:8781/live-operations-dashboard/?mode=tv'});
    for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll(".equipment-card").length===27&&document.readyState==="complete"'))break;await wait(100)}
    assert.equal(await evaluate('document.querySelectorAll(".equipment-card").length'),27);
    assert.equal(await evaluate('[...document.querySelectorAll(".legend-key span")].map(n=>n.textContent).join(",")'),'In Service,Warning,Out Of Service,Maintenance,Offline');
    await evaluate('document.fonts.ready');
    assert.ok(await evaluate('document.fonts.check("16px Inter")&&getComputedStyle(document.body).fontFamily.startsWith("Inter")'));
    await evaluate('document.querySelector("[data-ops-menu]").click()');
    assert.ok(await evaluate('document.getElementById("opsAppMenu").open'));
    assert.equal(await evaluate('document.querySelector(".ops-app-menu [aria-current=page]").dataset.opsDestination'),'equipment');
    assert.equal(await evaluate('document.querySelectorAll(".ops-app-menu [data-ops-destination]").length'),14);
    await evaluate('document.querySelector(".ops-app-menu-close").click();new Promise(r=>requestAnimationFrame(r))');
    assert.ok(await evaluate('[...document.images].every(image=>image.complete&&image.naturalWidth>0)'));
    assert.equal(await evaluate('document.querySelector(".header-qr").href'),'https://water.gibbhub.io/live-operations-dashboard/','QR opens the editor without TV mode');
    assert.ok(await evaluate('document.querySelector(".header-qr-image").src.includes("equipment-status-edit.svg")'));
    assert.equal(await evaluate('document.querySelector(".header-qr-image").getBoundingClientRect().width'),68,'Compact wall QR remains visible');
    assert.equal(await evaluate('document.getElementById("themeToggle")'),null);
    assert.equal(await evaluate('document.getElementById("displayOptionsButton")'),null);
    assert.equal(await evaluate('document.querySelector(".ops-header").getBoundingClientRect().height'),82,'Wall header reclaims space for equipment');
    assert.equal(await evaluate('innerWidth-document.querySelector("[data-ops-menu]").getBoundingClientRect().right'),32,'Apps retains its upper-right position in compact wall header');
    assert.ok(await evaluate('(()=>{const title=document.querySelector(".ops-titles").getBoundingClientRect(),qr=document.querySelector(".header-qr").getBoundingClientRect(),apps=document.querySelector("[data-ops-menu]").getBoundingClientRect();return title.right<qr.left && qr.right<apps.left})()'),'QR sits between title and Apps');
    const qrBounds=await evaluate('(()=>{const r=document.querySelector(".header-qr-image").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
    const qrShot=await call('Page.captureScreenshot',{format:'png',clip:qrBounds});
    fs.mkdirSync(path.join(root,'preview'),{recursive:true});fs.writeFileSync(path.join(root,'preview/live-ops-qr.png'),Buffer.from(qrShot.data,'base64'));
    await wait(250);
    const firstWallShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/wall-readable-1080.png'),Buffer.from(firstWallShot.data,'base64'));
    assert.ok(await evaluate('[...document.querySelectorAll(".equipment-card")].every(card=>card.offsetHeight>=150)'),'Full-width wall cards retain substantial height');
    console.log('Layout:',await evaluate('({height:document.documentElement.scrollHeight,groups:[...document.querySelectorAll(".group")].map(n=>n.offsetHeight),tiles:[...document.querySelectorAll(".equipment-card")].map(n=>n.offsetHeight)})'));
    assert.ok(await evaluate('document.documentElement.scrollHeight<=1080'),'TV fits 1080p');
    assert.equal(await evaluate('new Set([...document.querySelectorAll(".group")].map(n=>n.offsetHeight)).size'),1);
    assert.equal(await evaluate('new Set([...document.querySelectorAll(".equipment-card")].map(n=>n.offsetHeight)).size'),1,'All tiles have equal height');
    assert.ok(await evaluate('[...document.querySelectorAll(".equipment-card")].every(card=>card.getBoundingClientRect().bottom<=card.closest(".group").getBoundingClientRect().bottom)'), 'Every asset is visible inside its group');
    for(const [width,height] of [[1920,1440],[1920,900],[1920,720],[1366,768],[1280,720],[1280,600],[1024,768],[1024,600],[900,600]]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await wait(120);
      assert.ok(await evaluate('document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth'),'Desktop fits '+width+'x'+height);
      assert.equal(await evaluate('document.querySelectorAll(".equipment-card").length'),27);
      assert.ok(await evaluate('(()=>{const f=document.querySelector(".wall-footer").getBoundingClientRect(),b=document.getElementById("wallHeaderToggle").getBoundingClientRect();return Math.abs(f.right-b.right)<2&&b.bottom<=innerHeight})()'),'Header control stays at the far right at '+width+'x'+height);
      assert.ok(await evaluate('(()=>{const cards=[...document.querySelectorAll(".pump-groups-row .equipment-card")];return cards.length===8&&new Set(cards.map(c=>Math.round(c.getBoundingClientRect().top))).size===1})()'),'High Zone and Booster Pumps share one eight-card row');
      const commentSizes=await evaluate('[...document.querySelector(".comments-board").children].map(e=>[e.className,e.clientHeight,getComputedStyle(e).display])');
      assert.ok(await evaluate('document.querySelector(".comments-board").clientHeight>=108&&document.querySelector(".comments-list").clientHeight>=45'),'Comment list retains readable space at '+width+'x'+height+' '+JSON.stringify(commentSizes));
      assert.ok(await evaluate('(()=>{const p=document.querySelector(".comments-board").getBoundingClientRect(),e=document.querySelector(".equipment-layout").getBoundingClientRect();return p.top>=e.bottom&&p.width>innerWidth*.95&&e.width>innerWidth*.95})()'),'Comments sit below full-width equipment');
      if(width>=1900){const d=await evaluate('(()=>{const l=document.querySelector(".comments-list");return {height:l.clientHeight,scroll:l.scrollHeight,cards:[...l.children].map(c=>({height:c.clientHeight,width:c.clientWidth,message:c.querySelector(".comment-card-message")?.clientHeight,body:c.firstElementChild?.clientHeight}))}})()');assert.ok(d.scroll<=d.height+2,'Typical notes fit across the bottom '+JSON.stringify(d));}
      assert.ok(await evaluate('parseFloat(getComputedStyle(document.querySelector(".equipment-name")).fontSize)>=20'),'Equipment names never shrink below 20px in wall mode');
      const clippedNames=await evaluate('[...document.querySelectorAll(".equipment-card")].flatMap(card=>{const r=card.getBoundingClientRect(),g=card.closest(".group").getBoundingClientRect(),name=card.querySelector(".equipment-name").getBoundingClientRect();return r.height>20&&r.bottom<=innerHeight&&r.bottom<=g.bottom+1&&name.bottom<=r.bottom+1?[]:[{name:card.querySelector(".equipment-name").textContent,card:[r.top,r.bottom],nameBounds:[name.top,name.bottom],font:getComputedStyle(card.querySelector(".equipment-name")).fontSize}]})');
      if(clippedNames.length){console.log(JSON.stringify({width,height,clippedNames}));console.log(await evaluate('[...document.querySelector(".ops-page").children].filter(e=>getComputedStyle(e).position!=="fixed"&&e.offsetHeight).map(e=>[e.className,e.offsetHeight,getComputedStyle(e).minHeight])'));const shot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});fs.writeFileSync(path.join(root,"preview/wall-layout-failure.png"),Buffer.from(shot.data,"base64"));}
      assert.ok(!clippedNames.length,'All equipment names and tiles visible at '+width+'x'+height);
      console.log('All 27 equipment tiles fit '+width+'x'+height);
      if(width===1280&&height===600){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/live-ops-compact.png'),Buffer.from(shot.data,'base64'));}
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await wait(120);
    assert.ok(await evaluate('document.querySelector(".wall-footer").getBoundingClientRect().bottom<=1080'),'Footer is visible without internal page scrolling');
    assert.ok(await evaluate('document.querySelector(".recent-change")!==null'));
    assert.ok(await evaluate('document.querySelector(".more-notes")!==null'));
    // Contrast is measured from rendered colors, not shadows, in both themes.
    const contrast=await evaluate('(()=>{const rgb=s=>s.match(/\\d+/g).slice(0,3).map(Number);const lum=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll(".equipment-card")].map(c=>{const bg=lum(getComputedStyle(c).backgroundColor),fg=lum(getComputedStyle(c.querySelector(".equipment-name")).color);return(Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)})})()');
    assert.ok(contrast.every(ratio=>ratio>=4.5),'All rendered tile text exceeds 4.5:1 contrast');
    assert.ok(await evaluate('document.querySelector(".equipment-card[data-id=filters-filter-1] .equipment-note-preview").textContent.includes("submerged in media.")'),'Taller cards show the complete short warning note');
    const headerOnHeight=await evaluate('document.querySelector(".equipment-card").offsetHeight');
    await evaluate('document.getElementById("wallHeaderToggle").click()');await wait(150);
    assert.equal(await evaluate('document.querySelector(".ops-header").offsetHeight'),0,'Header can be hidden');
    assert.ok(await evaluate('document.getElementById("wallHeaderToggle").offsetHeight>=30&&document.getElementById("wallHeaderToggle").textContent==="Show Header"'),'Restore control remains available');
    assert.ok(await evaluate('document.querySelector(".equipment-card").offsetHeight')>=headerOnHeight+18,'Hiding the header increases every card height');
    assert.ok(await evaluate('document.documentElement.scrollHeight<=innerHeight'),'Header-free mode fits without scrolling');
    for(const [width,height] of [[1920,1080],[1280,600],[900,600]]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await wait(100);
      for(const dark of [false,true]){
        await evaluate('document.body.classList.toggle("wall-dark",'+dark+')');
        assert.ok(await evaluate('(()=>{const q=document.querySelector(".wall-footer .header-qr"),r=q.getBoundingClientRect(),c=document.querySelector(".comments-board").getBoundingClientRect(),e=document.querySelector(".equipment-layout").getBoundingClientRect(),b=document.getElementById("wallHeaderToggle").getBoundingClientRect();return document.querySelectorAll(".header-qr").length===1&&q.href==="https://water.gibbhub.io/live-operations-dashboard/"&&q.querySelector("img").getBoundingClientRect().width===68&&r.right<=innerWidth&&r.right>=innerWidth-24&&r.bottom<=innerHeight&&r.top>=e.bottom&&r.left>c.right&&r.left>b.right&&document.documentElement.scrollHeight<=innerHeight})()'),'Single editor QR stays visible in reserved bottom-right corner at '+width+'x'+height+' dark='+dark);
      }
    }
    await evaluate('document.body.classList.remove("wall-dark")');
    await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await wait(100);
    let headerShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/wall-header-hidden.png'),Buffer.from(headerShot.data,'base64'));
    await call('Page.reload');for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.querySelectorAll(".equipment-card").length===27'))break;await wait(50)}
    assert.equal(await evaluate('document.body.classList.contains("header-hidden")'),true,'Header preference survives reload');
    await evaluate('document.dispatchEvent(new CustomEvent("live-ops:connection",{detail:{connected:false}}))');
    assert.ok(await evaluate('document.getElementById("compactConnectionStatus").offsetHeight>0&&document.getElementById("compactConnectionStatus").textContent.includes("Connection lost")'),'Connection warning stays visible without the header');
    await evaluate('window.dispatchEvent(new Event("online"))');
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await wait(100);
    assert.equal(await evaluate('document.body.classList.contains("header-hidden")'),false,'Phone keeps its normal header');
    assert.ok(await evaluate('document.querySelector(".ops-header .header-qr").offsetHeight>0'),'Phone restores the QR to the header');
    await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await wait(150);
    assert.equal(await evaluate('document.body.classList.contains("header-hidden")'),true,'Returning to desktop restores the preference');
    await evaluate('document.getElementById("wallHeaderToggle").click()');await wait(150);
    assert.equal(await evaluate('document.querySelector(".ops-header").offsetHeight'),82,'Header restores without navigation');
    assert.ok(await evaluate('document.querySelector(".ops-header .header-qr").offsetHeight>0&&document.querySelectorAll(".header-qr").length===1'),'Showing header returns the same QR without duplicates');
    headerShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/wall-header-shown.png'),Buffer.from(headerShot.data,'base64'));
    console.log('Header comparison:',{shown:headerOnHeight,hidden:headerOnHeight+20});
    if(process.argv.includes('--layout-only')){console.log('Layout passed: full-width equipment, comments below, persistent header toggle, visible connection warnings and responsive restoration.');return;}
    assert.equal(await evaluate('document.querySelector(".comment-card").dataset.pinned'),'true','Pinned comment is first in the full list');
    const commentState=await (await fetch('http://127.0.0.1:3191/api/live-ops/state')).json();
    for(const comment of commentState.comments)assert.equal(await evaluate('document.querySelector("[data-comment-id='+comment.id+'] .comment-card-message").textContent'),comment.message,'Full comment text is preserved');
    assert.ok(JSON.parse(fs.readFileSync(path.join(temp,'live-ops-state.json'),'utf8')).comments.some(c=>c.pinned===true),'Pinned state persists to disk');
    await evaluate('document.querySelector(".equipment-card[data-id=filters-filter-8]").click()');
    assert.ok(await evaluate('document.getElementById("equipmentReadDialog").open'));
    assert.ok(await evaluate('document.getElementById("equipmentReadNote").textContent.includes("maintenance")'));
    await call('Page.navigate',{url:'http://127.0.0.1:8781/live-operations-dashboard/'});
    for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.querySelectorAll(".equipment-card").length===27'))break;await wait(100)}
    for(const [width,height] of [[1366,768],[1280,600],[1024,600],[900,600]]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await wait(120);
      assert.ok(await evaluate('document.documentElement.scrollHeight<=innerHeight'),'Editable desktop fits '+width+'x'+height);
      assert.ok(await evaluate('Math.abs(document.querySelector(".wall-footer").getBoundingClientRect().right-document.getElementById("wallHeaderToggle").getBoundingClientRect().right)<2'),'Editor header toggle is anchored to the footer right edge');
      assert.ok(await evaluate('document.querySelector(".comments-list").clientHeight>=60'),'Editable comments remain readable at '+width+'x'+height);
      assert.ok(await evaluate('(()=>{const r=document.getElementById("openCommentDrawerButton").getBoundingClientRect(),p=document.querySelector(".comments-board").getBoundingClientRect();return r.height>0&&r.top>=p.top&&r.bottom<=p.bottom})()'),'Add Comment stays inside its panel');
      assert.ok(await evaluate('[...document.querySelectorAll(".equipment-card")].every(card=>card.querySelector(".equipment-name").getBoundingClientRect().bottom<=card.getBoundingClientRect().bottom+1)'),'Editable desktop names remain visible');
    }
    await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});await wait(120);
    assert.ok(await evaluate('[...document.querySelectorAll(".equipment-card")].every(card=>card.offsetHeight>=130)'),'1080p editor cards grow beyond the previous 107px');
    assert.ok(await evaluate('[...document.querySelectorAll(".equipment-note-preview:not([hidden])")].some(note=>note.clientHeight>=parseFloat(getComputedStyle(note).lineHeight))'),'Notes expand again when the window grows');
    assert.ok(await evaluate('parseFloat(getComputedStyle(document.querySelector(".comment-card-author")).fontSize)<=11&&parseFloat(getComputedStyle(document.querySelector(".comment-card-date")).fontSize)<=10'),'Audit stamps are visually secondary');
    assert.ok(await evaluate('(()=>{const m=document.querySelector(".comment-card-message").getBoundingClientRect(),a=document.querySelector(".comment-card-meta").getBoundingClientRect();return m.top<a.top})()'),'Message appears before its audit line');
    assert.ok(await evaluate('document.querySelector(".comment-card-date").dateTime&&document.querySelector(".comment-card-date").title'),'Exact audit timestamp is retained');
    assert.equal(await evaluate('document.querySelector(".comment-icon-button svg").getBoundingClientRect().width'),16,'Action icons have a consistent 16px size');
    const polishShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/comments-polished-desktop.png'),Buffer.from(polishShot.data,'base64'));
    const detailBounds=await evaluate('(()=>{const r=document.querySelector(".comments-board").getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:innerHeight-r.y,scale:1}})()');
    const detailShot=await call('Page.captureScreenshot',{format:'png',clip:detailBounds});fs.writeFileSync(path.join(root,'preview/comments-polished-detail.png'),Buffer.from(detailShot.data,'base64'));
    await evaluate('document.querySelector(".equipment-card[data-id=filters-filter-8]").click()');
    assert.ok(await evaluate('document.getElementById("equipmentDrawer").classList.contains("is-open")'));
    await evaluate('window.prompt=()=>"Browser check";document.getElementById("drawerNotes").value="Verified note from isolated browser test";document.getElementById("drawerNotes").dispatchEvent(new Event("input"));document.getElementById("saveSidebarButton").click()');
    for(let i=0;i<50;i++){const state=await (await fetch('http://127.0.0.1:3191/api/live-ops/state')).json();if(state.equipment.find(n=>n.id==='filters-filter-8').note.includes('isolated browser'))break;await wait(100)}
    const changed=await (await fetch('http://127.0.0.1:3191/api/live-ops/state')).json();
    assert.equal(changed.equipment.find(n=>n.id==='filters-filter-8').note,'Verified note from isolated browser test');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("recentEquipmentChange").textContent.includes("notes updated")'))break;await wait(50)}
    assert.ok(await evaluate('document.getElementById("recentEquipmentChange").textContent.includes("notes updated")'),'Recent change explains the actual update');
    assert.ok(changed.equipment.find(n=>n.id==='filters-filter-8').changeLog[0].updatedBy==='Browser check');
    for(let i=0;i<50;i++){if(await evaluate('document.getElementById("saveSidebarButton").disabled'))break;await wait(100)}
    await evaluate('document.getElementById("drawerClose").click()');
    const comment=await fetch('http://127.0.0.1:3191/api/live-ops/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Isolated comment test',updatedBy:'Test operator'})});assert.ok(comment.ok);
    for(let i=0;i<50;i++){if(await evaluate('document.getElementById("generalCommentsList").textContent.includes("Isolated comment test")'))break;await wait(100)}
    assert.ok(await evaluate('document.getElementById("generalCommentsList").textContent.includes("Isolated comment test")'),'Comments arrive over SSE');
    // Pinning is a persisted operator choice, available through the existing comment workflow.
    await evaluate('window.prompt=()=>"Test operator";document.getElementById("openCommentDrawerButton").click();document.getElementById("generalCommentInput").value="Pinned notice from the real form";document.getElementById("generalCommentInput").dispatchEvent(new Event("input"));document.getElementById("generalCommentPinned").click();document.getElementById("generalCommentsForm").requestSubmit()');
    let pinnedComment;
    for(let i=0;i<100;i++){const state=await (await fetch('http://127.0.0.1:3191/api/live-ops/state')).json();pinnedComment=state.comments.find(c=>c.message==='Pinned notice from the real form');if(pinnedComment&&await evaluate('!document.getElementById("commentDrawer").classList.contains("is-open")'))break;await wait(50)}
    assert.equal(pinnedComment.pinned,true,'Real form saves pinned notice');
    await evaluate('document.querySelector("[data-comment-id='+pinnedComment.id+'] [data-action=edit]").click()');
    assert.equal(await evaluate('document.getElementById("generalCommentPinned").checked'),true,'Editor restores persisted pin choice');
    await evaluate('document.getElementById("generalCommentPinned").click();document.getElementById("generalCommentsForm").requestSubmit()');
    for(let i=0;i<100;i++){const state=await (await fetch('http://127.0.0.1:3191/api/live-ops/state')).json();if(state.comments.find(c=>c.id===pinnedComment.id).pinned===false&&await evaluate('!document.getElementById("commentDrawer").classList.contains("is-open")'))break;await wait(50)}
    assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'live-ops-state.json'),'utf8')).comments.find(c=>c.id===pinnedComment.id).pinned,false,'Unpin persists to disk');
    const updateUrl='http://127.0.0.1:3191/api/live-ops/comments/'+pinnedComment.id;
    assert.ok((await fetch(updateUrl,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:pinnedComment.message,updatedBy:'Test operator',pinned:true})})).ok);
    const legacyUpdate=await (await fetch(updateUrl,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:pinnedComment.message,updatedBy:'Old client'})})).json();
    assert.equal(legacyUpdate.comment.pinned,true,'Older clients cannot accidentally clear a pin by omitting the new field');
    const deletable=await (await fetch('http://127.0.0.1:3191/api/live-ops/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Temporary icon delete check',updatedBy:'Test operator'})})).json();
    for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector("[data-comment-id='+deletable.comment.id+']")'))break;await wait(50)}
    await evaluate('document.querySelector("[data-comment-id='+deletable.comment.id+'] [data-action=delete] svg").dispatchEvent(new MouseEvent("click",{bubbles:true}))');
    for(let i=0;i<100;i++){const state=await(await fetch('http://127.0.0.1:3191/api/live-ops/state')).json();if(!state.comments.some(c=>c.id===deletable.comment.id))break;await wait(50)}
    assert.ok(!(await(await fetch('http://127.0.0.1:3191/api/live-ops/state')).json()).comments.some(c=>c.id===deletable.comment.id),'New delete icon retains confirmation and actual deletion');
    for(let i=0;i<100;i++){if(await evaluate('!document.querySelector("[data-comment-id='+deletable.comment.id+']")'))break;await wait(50)}
    await wait(100);
    const statusEdit=await fetch('http://127.0.0.1:3191/api/live-ops/equipment/filters-filter-7',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'maintenance',updatedBy:'Test operator'})});assert.ok(statusEdit.ok);
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("recentEquipmentChange").textContent.includes("Filter 7 changed to Maintenance")'))break;await wait(50)}
    assert.ok(await evaluate('document.getElementById("recentEquipmentChange").textContent.includes("Filter 7 changed to Maintenance")'),'Actual status edit is named in the recent-change summary');
    fs.mkdirSync(path.join(root,'preview'),{recursive:true});
    for(const dark of [false,true]){
      await evaluate('localStorage.setItem("live-ops-wall-theme",'+JSON.stringify(dark?'dark':'light')+')');
      await call('Page.reload');
      for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.querySelectorAll(".equipment-card").length===27'))break;await wait(100)}
      assert.equal(await evaluate('document.body.classList.contains("wall-dark")'),dark);
      assert.ok((await evaluate('(()=>{const rgb=s=>s.match(/\\d+/g).slice(0,3).map(Number);const lum=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);return [...document.querySelectorAll(".equipment-card")].map(c=>{const bg=lum(getComputedStyle(c).backgroundColor),fg=lum(getComputedStyle(c.querySelector(".equipment-name")).color);return(Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)})})()')).every(ratio=>ratio>=4.5),'Tile contrast passes in both themes');
      await wait(100);
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(root,'preview/live-ops-'+(dark?'dark':'light')+'.png'),Buffer.from(shot.data,'base64'));
      await call('Page.navigate',{url:'http://127.0.0.1:8781/live-operations-dashboard/?mode=tv'});
      for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&!!document.querySelector(".comment-card")'))break;await wait(50)}
      await wait(150);const wallShot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'preview/wall-readable-'+(dark?'dark':'light')+'.png'),Buffer.from(wallShot.data,'base64'));
    }
    const longCommentResult=await (await fetch('http://127.0.0.1:3191/api/live-ops/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Long overflow note. '.repeat(100),updatedBy:'Overflow test'})})).json();
    for(let i=0;i<100;i++){if(await evaluate('!document.getElementById("commentsOverflowHint").hidden'))break;await wait(50)}
    assert.equal(await evaluate('document.getElementById("commentsOverflowHint").hidden'),false,'Oversized lists disclose overflow without hiding notes');
    assert.equal(await evaluate('document.querySelector("[data-comment-id='+longCommentResult.comment.id+'] .comment-card-message").textContent'),longCommentResult.comment.message,'Even oversized notes keep their complete text');
    await fetch('http://127.0.0.1:3191/api/live-ops/comments/'+longCommentResult.comment.id,{method:'DELETE'});
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("commentsOverflowHint").hidden'))break;await wait(50)}
    assert.equal(await evaluate('document.getElementById("commentsOverflowHint").hidden'),await evaluate('(()=>{const l=document.querySelector(".comments-list");return l.scrollHeight-l.scrollTop<=l.clientHeight+2})()'),'Overflow hint accurately reflects the remaining notes');
    refuseStream=true;for(const response of streamResponses)response.destroy();
    for(let i=0;i<100;i++){if(await evaluate('!document.getElementById("connectionAlert").hidden'))break;await wait(50)}
    assert.equal(await evaluate('document.getElementById("connectionAlert").hidden'),false,'Real stream interruption shows saved-data warning');
    const connectionsBeforeRecovery=streamConnections;refuseStream=false;
    await evaluate('window.dispatchEvent(new Event("online"))');
    for(let i=0;i<100;i++){if(streamConnections>connectionsBeforeRecovery&&await evaluate('document.getElementById("connectionAlert").hidden'))break;await wait(50)}
    assert.ok(streamConnections>connectionsBeforeRecovery,'Online event reconnects the stream');
    assert.equal(await evaluate('document.getElementById("connectionAlert").hidden'),true,'A real snapshot clears the warning');
    assert.ok(await evaluate('document.getElementById("wallSyncTime").textContent.startsWith("Last connection check:")'));
    const beforeWatchdog=streamConnections;dropStreamData=true;
    await evaluate('window.realCheckClock=Date.now;Date.now=()=>window.realCheckClock()+70000');
    for(let i=0;i<120;i++){if(streamConnections>beforeWatchdog)break;await wait(100)}
    await evaluate('Date.now=window.realCheckClock;delete window.realCheckClock');dropStreamData=false;
    assert.ok(streamConnections>beforeWatchdog,'Watchdog replaces a stalled connection without an online event');
    await evaluate('window.dispatchEvent(new Event("online"))');
    for(let i=0;i<100;i++){if(await evaluate('document.getElementById("connectionAlert").hidden'))break;await wait(50)}
    // Recover even when the first HTTP load and first stream both fail.
    refuseState=refuseStream=true;
    await call('Page.navigate',{url:'http://127.0.0.1:8781/live-operations-dashboard/?mode=tv'});
    for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"&&document.getElementById("equipmentContainer").textContent.includes("unavailable")'))break;await wait(50)}
    assert.equal(await evaluate('document.querySelectorAll(".equipment-card").length'),0,'Initial failure has no fake equipment statuses');
    refuseState=refuseStream=false;await evaluate('window.dispatchEvent(new Event("online"))');
    for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll(".equipment-card").length===27&&document.getElementById("connectionAlert").hidden'))break;await wait(50)}
    assert.equal(await evaluate('document.querySelectorAll(".equipment-card").length'),27,'A fresh snapshot recovers after initial API failure');
    assert.equal(await evaluate('document.getElementById("connectionAlert").hidden'),true);
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(100);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".recent-change"),"::after").animationName'),'none');
    await evaluate('document.dispatchEvent(new CustomEvent("live-ops:connection",{detail:{connected:false}}))');
    assert.equal(await evaluate('document.getElementById("connectionAlert").hidden'),false);
    for(const width of [390,768,1920]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1080,deviceScaleFactor:1,mobile:false});await wait(100);
      assert.ok(await evaluate('document.documentElement.scrollWidth<='+width),'No overflow at '+width);
    }
    assert.equal(errors.length,0,JSON.stringify(errors));
    // A real named heartbeat must reach clients without editing any equipment.
    const controller=new AbortController();const stream=await fetch('http://127.0.0.1:3191/api/live-ops/stream',{signal:controller.signal});
    const reader=stream.body.getReader();let text='';const timer=setTimeout(()=>controller.abort(),28000);
    try {while(!text.includes('event: heartbeat')){const chunk=await reader.read();if(chunk.done)break;text+=new TextDecoder().decode(chunk.value)}}finally{clearTimeout(timer);controller.abort()}
    assert.ok(text.includes('event: heartbeat'),'Real SSE heartbeat delivered');
    console.log('Passed: 27 stationary tiles, 20px minimum wall names, 4.5:1 contrast in both themes, bottom comments, persistent hide-header control and pinning, actual API edits/audit/SSE, interrupted/stalled/initial-failure recovery, reduced motion, editor and phone layouts.');
  } finally {
    try { await browser?.close(); } finally {
      api.kill();await new Promise(resolve=>{if(api.exitCode!==null||api.signalCode!==null)resolve();else api.once("exit",resolve)});
      server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));
      await removeTemporaryDirectory(temp);
    }
  }
})().catch(error=>{console.error(error);process.exitCode=1});

'use strict';
const crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {promisify}=require('node:util'),scrypt=promisify(crypto.scrypt);
const SESSION_MS=3*24*60*60*1000,WINDOW_MS=15*60*1000;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function makePassphraseHash(passphrase){
  if(typeof passphrase!=='string'||passphrase.length<8||passphrase.length>256)throw Error('Use a passphrase or code between 8 and 256 characters. A phrase of at least 12 characters is recommended.');
  const salt=crypto.randomBytes(16).toString('hex'),derived=await scrypt(passphrase,salt,64);
  return 'scrypt$'+salt+'$'+derived.toString('hex');
}
function safeNext(value){
  if(typeof value!=='string'||value.length>2048||/[\x00-\x20\\]/.test(value))return '/application-review/';
  try{const url=new URL(value,'https://review.invalid');if(url.origin==='https://review.invalid'&&/^\/(?:apps\/)?application-review(?:\/|$)/.test(url.pathname))return url.pathname+url.search+url.hash;}catch{}
  return '/application-review/';
}
function accessPage(content){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Application Review Access | Northglenn</title><link rel="icon" href="/assets/logos/favicon.png"><link rel="stylesheet" href="/shared/operations/theme.css"><style>*{box-sizing:border-box}body{margin:0;font-family:var(--ops-font-family,Arial,sans-serif);background:#edf2f4;color:#17262d}header{padding:24px 32px;background:white;border-bottom:1px solid #c2d2db}header img{width:min(300px,100%);height:auto}main{width:min(460px,calc(100% - 32px));margin:64px auto;padding:30px;background:white;border:1px solid #bdcfd8;border-top:5px solid #00677f;border-radius:10px}h1{font-size:27px;margin:0 0 12px}p{font-size:14px;line-height:1.6;color:#536b78}form{display:grid;gap:16px;margin-top:24px}label{display:grid;gap:8px;font-size:14px;font-weight:600}input{font:inherit;font-size:16px;width:100%;min-height:48px;padding:12px;border:1px solid #91aab8;border-radius:6px}button{font:inherit;font-weight:650;background:#00677f;color:white;border:0;border-radius:6px;min-height:48px;padding:12px;cursor:pointer}input:focus-visible,button:focus-visible{outline:3px solid #0097b5;outline-offset:3px}.error{color:#9c302c;background:#fff1ef;padding:12px;border-radius:6px}small{font-size:12px;color:#536b78;line-height:1.6}@media(max-width:500px){main{margin:32px auto;padding:24px}header{padding:20px}}</style></head><body><header><a href="/"><img src="/assets/logos/northglenn-horizontal.png" width="300" height="69" alt="City of Northglenn"></a></header><main>${content}</main></body></html>`;}
function loginPage(next,error='',configured=true,setupAvailable=false){
  return accessPage(`<h1>Application Review</h1>${configured?'<p>Enter the shared passphrase or access code to continue.</p>':'<p>Application Review is locked until first-time setup is completed.</p>'}${error?'<p class="error" role="alert">'+escape(error)+'</p>':''}${configured?'<form method="post" action="/application-review-access/login"><input type="hidden" name="next" value="'+escape(next)+'"><label>Passphrase Or Access Code<input type="password" name="passphrase" autocomplete="current-password" required maxlength="256" autofocus></label><button type="submit">Continue</button><small>This browser stays signed in for 3 days. Use Sign Out when you finish on a shared computer.</small></form>':setupAvailable?'<p><a href="/application-review-access/setup">First-Time Setup</a></p>':''}`);
}
function setupPage(error=''){
  return accessPage(`<h1>Set Up Application Review</h1><p>Enter your private one-time setup code, then choose the shared passphrase or access code for reviewers.</p>${error?'<p class="error" role="alert">'+escape(error)+'</p>':''}<form method="post" action="/application-review-access/setup"><label>One-Time Setup Code<input type="password" name="setupCode" autocomplete="off" required maxlength="128"></label><label>New Passphrase Or Code<input type="password" name="newPassphrase" autocomplete="new-password" required minlength="8" maxlength="256"></label><label>Confirm New Passphrase Or Code<input type="password" name="confirmPassphrase" autocomplete="new-password" required minlength="8" maxlength="256"></label><button type="submit">Set Passphrase</button><small>Use at least 8 characters; a phrase of at least 12 characters is recommended. The setup code expires after 24 hours and cannot be reused after setup.</small></form>`);
}

function register(app,options={}){
  const express=require('express');
  const initialVerifier=options.verifier??process.env.APPLICATION_REVIEW_PASSPHRASE_HASH??'';
  const validVerifier=value=>typeof value==='string'&&/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(value);
  let verifier=initialVerifier,configured=validVerifier(verifier);
  const secureCookies=options.secureCookies??process.env.NODE_ENV==='production';
  const cookieName=secureCookies?'__Host-applicationReview':'applicationReviewDev';
  const directory=options.directory||process.env.APPLICATION_REVIEW_AUTH_DIR||path.join(__dirname,'data','application-review-access');
  const file=path.join(directory,'access.json'),clock=options.now||Date.now;
  const root=options.staticRoot||path.join(__dirname,'apps','application-review');
  const setupFile=path.join(directory,'setup-code.txt'),seedFingerprint=hash(initialVerifier);
  let state={fingerprint:hash(verifier),seedFingerprint,verifier,sessions:{},failures:{}},storageError=false,queue=Promise.resolve(),pendingLogins=0;
  const write=async(value=state)=>{await fs.mkdir(directory,{recursive:true,mode:0o700});const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(value),{mode:0o600});await fs.rename(tmp,file);};
  const ensureSetup=async()=>{
    if(configured||storageError)return;
    if(state.setupExpiresAt>clock()&&/^[a-f0-9]{64}$/.test(state.setupHash||'')){try{await fs.access(setupFile);return;}catch{}}
    const code=crypto.randomBytes(32).toString('hex');
    await fs.mkdir(directory,{recursive:true,mode:0o700});await fs.writeFile(setupFile,code+'\n',{mode:0o600});
    state.setupHash=hash(code);state.setupExpiresAt=clock()+24*60*60*1000;await write();
  };
  const ready=(async()=>{
    if(initialVerifier&&!configured){storageError=true;return;}
    try{
      let saved,exists=false;try{saved=JSON.parse(await fs.readFile(file,'utf8'));exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
      if(exists&&(!saved||typeof saved!=='object'||Array.isArray(saved)))throw Error('Invalid access storage');
      if(saved){
        if(typeof saved.sessions!=='object'||!saved.sessions||Array.isArray(saved.sessions)||typeof saved.failures!=='object'||!saved.failures||Array.isArray(saved.failures))throw Error('Invalid access storage');
        const stored=typeof saved.verifier==='string';
        if(Object.hasOwn(saved,'verifier')&&!stored)throw Error('Invalid access verifier');
        if(stored&&!/^[a-f0-9]{64}$/.test(saved.seedFingerprint||''))throw Error('Invalid credential source');
        if(stored&&saved.verifier!==''&&!validVerifier(saved.verifier))throw Error('Invalid access verifier');
        if(stored&&(!initialVerifier||saved.seedFingerprint===seedFingerprint)){
          if(saved.fingerprint!==hash(saved.verifier))throw Error('Invalid credential state');
          verifier=saved.verifier;configured=validVerifier(verifier);state=saved;
        }else if(!stored&&saved.fingerprint===hash(initialVerifier)){state={...saved,verifier,seedFingerprint};}
        else await write();
        for(const [key,value] of Object.entries(state.sessions))if(!/^[a-f0-9]{64}$/.test(key)||!Number.isFinite(value))throw Error('Invalid session');
        for(const value of Object.values(state.failures))if(!Number.isFinite(value.until)||!Number.isInteger(value.count)||value.count<0)throw Error('Invalid attempt record');
      }
      if(!configured)await ensureSetup();
      else await fs.unlink(setupFile).catch(error=>{if(error.code!=='ENOENT')throw error;});
    }catch{storageError=true;console.error('Application Review access storage unavailable. Access remains locked.');}
  })();
  const serialized=operation=>{const job=queue.catch(()=>{}).then(operation);queue=job;return job;};
  const token=req=>{const values=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));return values.length===1?values[0].slice(cookieName.length+1):'';};
  const authenticated=req=>{const value=token(req);return configured&&!storageError&&/^[a-f0-9]{64}$/.test(value)&&state.sessions[hash(value)]>clock();};
  const headers=(req,res,next)=>{res.set({'Cache-Control':'no-store, private','Pragma':'no-cache','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});next();};
  const sameOrigin=req=>{try{const origin=new URL(req.headers.origin);return origin.host===req.headers.host&&['http:','https:'].includes(origin.protocol)&&(!secureCookies||origin.protocol==='https:');}catch{return false;}};
  const cookieOptions={httpOnly:true,secure:secureCookies,sameSite:'lax',path:'/'};
  const prune=()=>{for(const [key,expiry] of Object.entries(state.sessions))if(expiry<=clock())delete state.sessions[key];for(const [key,value] of Object.entries(state.failures))if(value.until<=clock())delete state.failures[key];};
  const attemptInfo=req=>{
    prune();const address=req.socket.remoteAddress||'unknown',localHop=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address),key=hash(localHop?(req.get('X-Real-IP')||address):address);
    const blocked=[state.failures[key],state.failures.global].find(r=>r&&r.count>=(r===state.failures.global?100:10));
    return {key,retryAfter:blocked||Object.keys(state.failures).length>1000?Math.max(1,Math.ceil(((blocked?.until||clock()+WINDOW_MS)-clock())/1000)):0};
  };
  const failedAttempt=async key=>{for(const id of [key,'global']){const record=state.failures[id]||{count:0,until:clock()+WINDOW_MS};record.count++;state.failures[id]=record;}await write();};
  const verify=async value=>{
    if(typeof value!=='string'||value.length<8||value.length>256||!configured)return false;
    const [,salt,digest]=verifier.split('$'),actual=await scrypt(value,salt,64);return crypto.timingSafeEqual(actual,Buffer.from(digest,'hex'));
  };
  const activate=async(nextVerifier,res)=>{
    const value=crypto.randomBytes(32).toString('hex'),expiresAt=clock()+SESSION_MS;
    const replacement={verifier:nextVerifier,fingerprint:hash(nextVerifier),seedFingerprint,sessions:{[hash(value)]:expiresAt},failures:{}};
    await write(replacement);state=replacement;verifier=nextVerifier;configured=true;
    await fs.unlink(setupFile).catch(()=>{});res.cookie(cookieName,value,{...cookieOptions,maxAge:SESSION_MS});return expiresAt;
  };
  app.use('/application-review-access',headers);
  app.get('/application-review-access',async(req,res)=>{await ready;const next=safeNext(req.query.next);if(authenticated(req))return res.redirect(303,next);res.set('Content-Security-Policy',"default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");res.status(configured&&!storageError?200:503).send(loginPage(next,storageError?'Access is temporarily unavailable. Contact the administrator.':'',configured&&!storageError,!configured&&!storageError));});
  app.get('/application-review-access/status',async(req,res)=>{await ready;res.json({authenticated:authenticated(req),expiresAt:authenticated(req)?state.sessions[hash(token(req))]:null});});
  app.get('/application-review-access/setup',async(req,res)=>{
    await ready;if(storageError)return res.status(503).send(accessPage('<h1>Access Unavailable</h1><p>Contact the administrator.</p>'));
    if(configured)return res.status(404).send(accessPage('<h1>Setup Is Complete</h1><p>Sign in and use Access Settings to change the passphrase.</p><a href="/application-review-access">Sign In</a>'));
    try{await serialized(ensureSetup);res.send(setupPage());}catch{storageError=true;res.status(503).send(accessPage('<h1>Access Unavailable</h1><p>Contact the administrator.</p>'));}
  });
  app.post('/application-review-access/setup',express.urlencoded({extended:false,limit:'8kb'}),async(req,res)=>{
    await ready;if(!sameOrigin(req))return res.status(403).send('Complete setup from the application page using HTTPS.');
    if(storageError)return res.status(503).send(setupPage('Access is unavailable. Contact the administrator.'));
    if(configured)return res.status(409).send(accessPage('<h1>Setup Is Complete</h1><p>The one-time setup code can no longer be used.</p>'));
    if(pendingLogins>=20)return res.status(429).set('Retry-After','60').send(setupPage('Too many requests. Please wait a minute.'));
    pendingLogins++;
    try{await serialized(async()=>{
      if(configured)return res.status(409).send(accessPage('<h1>Setup Is Complete</h1>'));
      const {key,retryAfter}=attemptInfo(req);if(retryAfter)return res.status(429).set('Retry-After',String(retryAfter)).send(setupPage('Too many incorrect attempts. Try again in 15 minutes.'));
      const code=typeof req.body?.setupCode==='string'?req.body.setupCode.trim():'';
      if(!code||code.length>128||!(state.setupExpiresAt>clock())||!state.setupHash||!crypto.timingSafeEqual(Buffer.from(hash(code),'hex'),Buffer.from(state.setupHash,'hex'))){await failedAttempt(key);return res.status(401).send(setupPage('The setup code is incorrect or has expired.'));}
      if(typeof req.body.newPassphrase!=='string'||req.body.newPassphrase!==req.body.confirmPassphrase)return res.status(400).send(setupPage('The new passphrase entries did not match.'));
      let nextVerifier;try{nextVerifier=await makePassphraseHash(req.body.newPassphrase);}catch(error){return res.status(400).send(setupPage(error.message));}
      await activate(nextVerifier,res);res.redirect(303,'/application-review/');
    });}catch{storageError=true;res.status(503).send(setupPage('Unable to save access. Contact the administrator.'));}finally{pendingLogins--;}
  });
  app.post('/application-review-access/passphrase',express.json({limit:'8kb'}),async(req,res)=>{
    await ready;if(!sameOrigin(req))return res.status(403).json({error:'Change the passphrase from the application page.'});
    if(storageError||!configured)return res.status(503).json({error:'Access settings are unavailable.'});
    if(!authenticated(req))return res.status(401).json({error:'Sign in again before changing the passphrase.',code:'REVIEW_AUTH_REQUIRED'});
    if(pendingLogins>=20)return res.status(429).set('Retry-After','60').json({error:'Too many requests. Please wait a minute.'});
    pendingLogins++;
    try{await serialized(async()=>{
      if(!authenticated(req))return res.status(401).json({error:'Your access session changed. Sign in again.',code:'REVIEW_AUTH_REQUIRED'});
      const {key,retryAfter}=attemptInfo(req);if(retryAfter)return res.status(429).set('Retry-After',String(retryAfter)).json({error:'Too many incorrect attempts. Try again in 15 minutes.'});
      if(!await verify(req.body?.currentPassphrase)){await failedAttempt(key);return res.status(400).json({error:'The current passphrase was not recognized.'});}
      if(typeof req.body.newPassphrase!=='string'||req.body.newPassphrase!==req.body.confirmPassphrase)return res.status(400).json({error:'The new passphrase entries did not match.'});
      if(req.body.newPassphrase===req.body.currentPassphrase)return res.status(400).json({error:'Choose a different new passphrase.'});
      let nextVerifier;try{nextVerifier=await makePassphraseHash(req.body.newPassphrase);}catch(error){return res.status(400).json({error:error.message});}
      const expiresAt=await activate(nextVerifier,res);res.json({message:'Passphrase changed. Other browsers have been signed out. This browser stays signed in for 3 days.',expiresAt});
    });}catch{storageError=true;res.status(503).json({error:'Unable to save the passphrase. Contact the administrator.'});}finally{pendingLogins--;}
  });
  app.post('/application-review-access/login',express.urlencoded({extended:false,limit:'8kb'}),async(req,res)=>{
    await ready;const next=safeNext(req.body?.next);
    if(!sameOrigin(req))return res.status(403).send('Sign in from the Application Review page using HTTPS.');
    if(!configured||storageError)return res.status(503).send(loginPage(next,'Access is locked. Contact the administrator.',false));
    if(pendingLogins>=20)return res.status(429).set('Retry-After','60').send(loginPage(next,'Too many sign-in requests. Please wait a minute.'));
    pendingLogins++;
    try{await serialized(async()=>{
      prune();
      // Trust only the local nginx hop's overwritten address, never arbitrary X-Forwarded-For.
      const address=req.socket.remoteAddress||'unknown',localHop=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address),key=hash(localHop?(req.get('X-Real-IP')||address):address);
      const records=[state.failures[key],state.failures.global],blocked=records.find(r=>r&&r.count>=(r===state.failures.global?100:10));
      if(blocked||Object.keys(state.failures).length>1000)return res.status(429).set('Retry-After',String(Math.max(1,Math.ceil(((blocked?.until||clock()+WINDOW_MS)-clock())/1000)))).send(loginPage(next,'Too many incorrect attempts. Try again in 15 minutes.'));
      const passphrase=req.body?.passphrase;let valid=false;
      if(typeof passphrase==='string'&&passphrase.length>=8&&passphrase.length<=256){const [,salt,digest]=verifier.split('$'),actual=await scrypt(passphrase,salt,64);valid=crypto.timingSafeEqual(actual,Buffer.from(digest,'hex'));}
      if(!valid){for(const id of [key,'global']){const record=state.failures[id]||{count:0,until:clock()+WINDOW_MS};record.count++;state.failures[id]=record;}await write();return res.status(401).send(loginPage(next,'That passphrase or code was not recognized.'));}
      if(Object.keys(state.sessions).length>=5000)return res.status(503).send(loginPage(next,'Access is temporarily unavailable. Contact the administrator.'));
      const value=crypto.randomBytes(32).toString('hex');state.sessions[hash(value)]=clock()+SESSION_MS;delete state.failures[key];await write();res.cookie(cookieName,value,{...cookieOptions,maxAge:SESSION_MS});res.redirect(303,next);
    });}catch{storageError=true;res.status(503).send(loginPage(next,'Unable to save access. Contact the administrator.',false));}finally{pendingLogins--;}
  });
  app.post('/application-review-access/logout',async(req,res)=>{
    await ready;if(!sameOrigin(req))return res.status(403).json({error:'Sign out from the application page.'});
    try{await serialized(async()=>{delete state.sessions[hash(token(req))];if(configured&&!storageError)await write();});res.clearCookie(cookieName,cookieOptions);res.status(204).end();}catch{storageError=true;res.status(503).json({error:'Unable to sign out. Close this browser and contact the administrator.'});}
  });
  const guard=api=>async(req,res,next)=>{
    headers(req,res,()=>{});await ready;
    if(!configured||storageError){if(api)return res.status(503).json({error:'Application Review access is locked. Contact the administrator.'});return res.redirect(303,'/application-review-access');}
    if(!authenticated(req)){if(api)return res.status(401).json({error:'Your access session expired. Sign in again.',code:'REVIEW_AUTH_REQUIRED'});return res.redirect(303,'/application-review-access?next='+encodeURIComponent(safeNext(req.originalUrl)));}
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!sameOrigin(req))return res.status(403).json({error:'Save changes from the application page.'});
    next();
  };
  app.use('/api/application-review',guard(true));
  // Serve protected assets through Node too, including the alternate /apps URL.
  const staticFiles=express.static(root,{cacheControl:false,fallthrough:false,dotfiles:'deny'});
  app.use(['/application-review','/apps/application-review'],guard(false),staticFiles,(error,req,res,next)=>{if(error)res.status(error.status||500).end();else next();});
  return {ready,cookieName};
}
module.exports={register,makePassphraseHash,SESSION_MS,safeNext};

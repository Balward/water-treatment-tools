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
function loginPage(next,error='',configured=true){
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Application Review Access | Northglenn</title><link rel="icon" href="/assets/logos/favicon.png"><link rel="stylesheet" href="/shared/operations/theme.css"><style>*{box-sizing:border-box}body{margin:0;font-family:var(--ops-font-family,Arial,sans-serif);background:#edf2f4;color:#17262d}header{padding:24px 32px;background:white;border-bottom:1px solid #c2d2db}header img{width:min(300px,100%);height:auto}main{width:min(460px,calc(100% - 32px));margin:64px auto;padding:30px;background:white;border:1px solid #bdcfd8;border-top:5px solid #00677f;border-radius:10px}h1{font-size:27px;margin:0 0 12px}p{font-size:14px;line-height:1.6;color:#536b78}form{display:grid;gap:16px;margin-top:24px}label{display:grid;gap:8px;font-size:14px;font-weight:600}input{font:inherit;font-size:16px;width:100%;min-height:48px;padding:12px;border:1px solid #91aab8;border-radius:6px}button{font:inherit;font-weight:650;background:#00677f;color:white;border:0;border-radius:6px;min-height:48px;padding:12px;cursor:pointer}input:focus-visible,button:focus-visible{outline:3px solid #0097b5;outline-offset:3px}.error{color:#9c302c;background:#fff1ef;padding:12px;border-radius:6px}small{font-size:12px;color:#536b78;line-height:1.6}@media(max-width:500px){main{margin:32px auto;padding:24px}header{padding:20px}}</style></head><body><header><a href="/"><img src="/assets/logos/northglenn-horizontal.png" width="300" height="69" alt="City of Northglenn"></a></header><main><h1>Application Review</h1>${configured?'<p>Enter the shared passphrase or access code to continue.</p>':'<p>Access is locked until the administrator configures a passphrase on the server.</p>'}${error?`<p class="error" role="alert">${escape(error)}</p>`:''}${configured?`<form method="post" action="/application-review-access/login"><input type="hidden" name="next" value="${escape(next)}"><label>Passphrase Or Access Code<input type="password" name="passphrase" autocomplete="current-password" required maxlength="256" autofocus></label><button type="submit">Continue</button><small>This browser stays signed in for 3 days. Use Sign Out when you finish on a shared computer.</small></form>`:''}</main></body></html>`;
}
function register(app,options={}){
  const express=require('express');
  const verifier=options.verifier??process.env.APPLICATION_REVIEW_PASSPHRASE_HASH??'';
  const configured=/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(verifier);
  const secureCookies=options.secureCookies??process.env.NODE_ENV==='production';
  const cookieName=secureCookies?'__Host-applicationReview':'applicationReviewDev';
  const directory=options.directory||process.env.APPLICATION_REVIEW_AUTH_DIR||path.join(__dirname,'data','application-review-access');
  const file=path.join(directory,'access.json'),clock=options.now||Date.now;
  const root=options.staticRoot||path.join(__dirname,'apps','application-review');
  const fingerprint=hash(verifier);let state={fingerprint,sessions:{},failures:{}},storageError=false,queue=Promise.resolve(),pendingLogins=0;
  const write=async()=>{await fs.mkdir(directory,{recursive:true,mode:0o700});const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(state),{mode:0o600});await fs.rename(tmp,file);};
  const ready=(async()=>{
    if(!configured)return;
    try{
      const saved=JSON.parse(await fs.readFile(file,'utf8'));
      if(!saved||typeof saved.sessions!=='object'||!saved.sessions||Array.isArray(saved.sessions)||typeof saved.failures!=='object'||!saved.failures||Array.isArray(saved.failures))throw Error('Invalid access storage');
      if(saved.fingerprint===fingerprint){state=saved;for(const [key,value] of Object.entries(state.sessions))if(!/^[a-f0-9]{64}$/.test(key)||!Number.isFinite(value))throw Error('Invalid session');for(const value of Object.values(state.failures))if(!Number.isFinite(value.until)||!Number.isInteger(value.count)||value.count<0)throw Error('Invalid attempt record');}
      else await write();
    }catch(error){if(error.code==='ENOENT')return;storageError=true;console.error('Application Review access storage unavailable. Access remains locked.');}
  })();
  const serialized=operation=>{const job=queue.catch(()=>{}).then(operation);queue=job;return job;};
  const token=req=>{const values=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));return values.length===1?values[0].slice(cookieName.length+1):'';};
  const authenticated=req=>{const value=token(req);return configured&&!storageError&&/^[a-f0-9]{64}$/.test(value)&&state.sessions[hash(value)]>clock();};
  const headers=(req,res,next)=>{res.set({'Cache-Control':'no-store, private','Pragma':'no-cache','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});next();};
  const sameOrigin=req=>{try{const origin=new URL(req.headers.origin);return origin.host===req.headers.host&&['http:','https:'].includes(origin.protocol)&&(!secureCookies||origin.protocol==='https:');}catch{return false;}};
  const cookieOptions={httpOnly:true,secure:secureCookies,sameSite:'lax',path:'/'};
  const prune=()=>{for(const [key,expiry] of Object.entries(state.sessions))if(expiry<=clock())delete state.sessions[key];for(const [key,value] of Object.entries(state.failures))if(value.until<=clock())delete state.failures[key];};
  app.use('/application-review-access',headers);
  app.get('/application-review-access',async(req,res)=>{await ready;const next=safeNext(req.query.next);if(authenticated(req))return res.redirect(303,next);res.set('Content-Security-Policy',"default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");res.status(configured&&!storageError?200:503).send(loginPage(next,storageError?'Access is temporarily unavailable. Contact the administrator.':'',configured&&!storageError));});
  app.get('/application-review-access/status',async(req,res)=>{await ready;res.json({authenticated:authenticated(req),expiresAt:authenticated(req)?state.sessions[hash(token(req))]:null});});
  app.post('/application-review-access/login',express.urlencoded({extended:false,limit:'2kb'}),async(req,res)=>{
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

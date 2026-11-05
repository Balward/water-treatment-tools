const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),express=require('express');
const auth=require('../application-review-auth'),registerAPI=require('../application-review-api'),model=require('../apps/application-review/model');
const {replaceSetting}=require('../set-application-review-passphrase');
const passphrase='Synthetic Test Passphrase 2026!';
async function harness(t,options={}){
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'review-auth-'));let server;
  const verifier=options.verifier??await auth.makePassphraseHash(passphrase);
  const start=async(extra={})=>{const app=express();auth.register(app,{verifier,secureCookies:false,directory:path.join(directory,'access'),...options,...extra});app.use(express.json());registerAPI(app,{directory:path.join(directory,'reviews')});app.get('/unrelated',(req,res)=>res.send('Other app available'));server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});return 'http://127.0.0.1:'+server.address().port;};
  let base=await start();t.after(async()=>{if(server)await new Promise(r=>server.close(r));await fs.rm(directory,{recursive:true,force:true});});
  return {directory,get base(){return base;},async restart(extra){await new Promise(r=>server.close(r));base=await start(extra);},async login(value=passphrase,next='/application-review/?hiringReview=review-original',headers={}){return fetch(base+'/application-review-access/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:base,...headers},body:new URLSearchParams({passphrase:value,next})});}};
}
test('all review entry points and APIs require access; login survives refresh and restart for exactly three days',async t=>{
  let now=Date.now();const h=await harness(t,{now:()=>now});
  for(const route of ['/application-review/','/application-review/index.html','/application-review/model.js','/apps/application-review/index.html','/apps/application-review/script.js']){
    const r=await fetch(h.base+route,{redirect:'manual'});assert.equal(r.status,303);assert.match(r.headers.get('location'),/^\/application-review-access/);assert.match(r.headers.get('x-robots-tag'),/noindex/);assert.match(r.headers.get('cache-control'),/no-store/);
  }
  for(const route of ['/api/application-review','/api/application-review/sets','/api/application-review/sets/review-original'])assert.equal((await fetch(h.base+route)).status,401);
  assert.equal((await fetch(h.base+'/api/application-review',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  assert.equal((await fetch(h.base+'/unrelated')).status,200);
  const login=await h.login();assert.equal(login.status,303);assert.equal(login.headers.get('location'),'/application-review/?hiringReview=review-original');
  const setCookie=login.headers.get('set-cookie'),cookie=setCookie.split(';')[0];assert.match(setCookie,/HttpOnly/i);assert.match(setCookie,/SameSite=Lax/i);assert.match(setCookie,/Max-Age=259200/i);
  for(let refresh=0;refresh<3;refresh++)assert.equal((await fetch(h.base+'/application-review/',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(h.base+'/api/application-review/sets',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await fetch(h.base+'/apps/application-review/index.html',{headers:{Cookie:cookie}})).status,200);
  const saved=await fs.readFile(path.join(h.directory,'access/access.json'),'utf8');assert.ok(!saved.includes(cookie.split('=')[1])&&!saved.includes(passphrase),'Only token digests are stored');
  await h.restart();assert.equal((await fetch(h.base+'/api/application-review/sets',{headers:{Cookie:cookie}})).status,200,'Session survives container restart');
  now+=auth.SESSION_MS-1;assert.equal((await fetch(h.base+'/api/application-review/sets',{headers:{Cookie:cookie}})).status,200);
  now++;assert.equal((await fetch(h.base+'/api/application-review/sets',{headers:{Cookie:cookie}})).status,401,'Absolute expiry is enforced without sliding on refresh');
});
test('incorrect attempts are throttled despite spoofed forwarding headers and remain throttled across restart',async t=>{
  let now=Date.now();const h=await harness(t,{now:()=>now});
  for(let i=0;i<10;i++)assert.equal((await h.login('Wrong test code',undefined,{'X-Forwarded-For':'192.0.2.'+i})).status,401);
  assert.equal((await h.login()).status,429);await h.restart();assert.equal((await h.login()).status,429);
  now+=15*60*1000+1;assert.equal((await h.login()).status,303);
});
test('logout revokes the server session; changing the passphrase invalidates old sessions without modifying reviews',async t=>{
  const h=await harness(t),login=await h.login(),cookie=login.headers.get('set-cookie').split(';')[0];
  const saved=model.apply(model.blank(),{type:'applicant',name:'Private Applicant',state:'CO',wage:null,licenses:''});
  await fs.mkdir(path.join(h.directory,'reviews'));await fs.writeFile(path.join(h.directory,'reviews/review.json'),JSON.stringify(saved));
  assert.equal((await fetch(h.base+'/application-review-access/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://other.invalid'}})).status,403);
  assert.equal((await fetch(h.base+'/application-review-access/logout',{method:'POST',headers:{Cookie:cookie,Origin:h.base}})).status,204);
  assert.equal((await fetch(h.base+'/api/application-review',{headers:{Cookie:cookie}})).status,401);
  const newer=(await h.login()).headers.get('set-cookie').split(';')[0];await h.restart({verifier:await auth.makePassphraseHash('Different Test Passphrase!')});
  assert.equal((await fetch(h.base+'/api/application-review',{headers:{Cookie:newer}})).status,401);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(h.directory,'reviews/review.json'),'utf8')),saved);
});
test('missing configuration and corrupt session storage fail closed; forged cookies and cross-origin requests are rejected',async t=>{
  const missing=await harness(t,{verifier:''});assert.equal((await fetch(missing.base+'/application-review-access')).status,503);assert.equal((await fetch(missing.base+'/api/application-review')).status,503);
  const h=await harness(t);assert.equal((await h.login(passphrase,undefined,{Origin:'https://other.invalid'})).status,403);
  assert.equal((await fetch(h.base+'/api/application-review',{headers:{Cookie:'applicationReviewDev='+'a'.repeat(64)}})).status,401);
  await fs.mkdir(path.join(h.directory,'access'),{recursive:true});await fs.writeFile(path.join(h.directory,'access/access.json'),'broken');await h.restart();assert.equal((await fetch(h.base+'/api/application-review')).status,503);
});
test('production sessions use Secure host cookies, safe redirects, and hashed configuration without command-line passphrases',async t=>{
  const h=await harness(t,{secureCookies:true});const origin=h.base.replace('http:','https:');
  assert.equal((await h.login()).status,403,'Production sign-in rejects an HTTP origin');
  const response=await h.login(passphrase,'https://outside.invalid',{'Origin':origin});assert.equal(response.status,303);assert.equal(response.headers.get('location'),'/application-review/');
  const cookie=response.headers.get('set-cookie');assert.match(cookie,/^__Host-applicationReview=/);assert.match(cookie,/; Secure/);assert.match(cookie,/; Path=\//);assert.ok(!cookie.includes('Domain='));
  for(const next of ['//outside.invalid','/application-review/../../elsewhere','/api/application-review/sets','/application-review/\r\nLocation:bad'])assert.equal(auth.safeNext(next),'/application-review/');
  const verifier=await auth.makePassphraseHash(passphrase),contents=replaceSetting('OTHER_SETTING=keep\nAPPLICATION_REVIEW_PASSPHRASE_HASH=old\n',verifier);
  assert.ok(contents.includes('OTHER_SETTING=keep'));assert.ok(!contents.includes(passphrase));assert.equal(require('dotenv').parse(contents).APPLICATION_REVIEW_PASSPHRASE_HASH,verifier);assert.equal((contents.match(/APPLICATION_REVIEW_PASSPHRASE_HASH=/g)||[]).length,1);assert.ok(contents.includes("='scrypt$"));
  await assert.rejects(auth.makePassphraseHash('2350'),/8 and 256/);
});

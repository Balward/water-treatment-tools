'use strict';
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');

function reject(status, message) { throw Object.assign(new Error(message), {status}); }
function validId(id) { return typeof id === 'string' && /^[a-zA-Z0-9-]{1,90}$/.test(id); }
function textField(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) reject(400,'Invalid project or location field.');
  return value.trim();
}
module.exports = function register(app, directory = path.join(__dirname,'data','project-board')) {
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const keyPath = path.join(directory,'access-key.txt');
  if (!fs.existsSync(keyPath)) fs.writeFileSync(keyPath,crypto.randomBytes(24).toString('base64url')+'\n',{flag:'wx',mode:0o600});
  const key = fs.readFileSync(keyPath,'utf8').trim();
  if (key.length < 32) throw Error('Invalid board access key');
  const db = new DatabaseSync(path.join(directory,'board.sqlite'));
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, details TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS locations(name TEXT PRIMARY KEY COLLATE NOCASE);
    CREATE TABLE IF NOT EXISTS files(projectId TEXT REFERENCES projects(id), id TEXT, name TEXT NOT NULL, contents BLOB NOT NULL, PRIMARY KEY(projectId,id));`);
  const router = express.Router();
  app.use('/api/project-board',router);
  const sign = expires => crypto.createHmac('sha256',key).update('board-session:'+expires).digest('hex');
  const cookie = process.env.NODE_ENV === 'production' ? '__Host-boardSession' : 'boardSession';
  const equal = (a,b) => a.length === b.length && crypto.timingSafeEqual(a,b);
  router.use((req,res,next)=>{
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    if (!['GET','HEAD'].includes(req.method)) {
      let origin;
      try { origin = new URL(req.get('Origin')); } catch {}
      if (origin?.host !== req.get('host') || (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) return res.sendStatus(403);
    }
    next();
  });
  router.post('/login',express.json({limit:'1kb'}),(req,res)=>{
    if (!equal(Buffer.from(String(req.body?.key || '')),Buffer.from(key))) return res.status(401).json({error:'Incorrect board access key.'});
    const age = 3*86400000, expires = String(Date.now()+age);
    res.cookie(cookie,expires+'.'+sign(expires),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:age,path:'/'});
    res.json({ok:true});
  });
  router.use((req,res,next)=>{
    const value = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie+'='))?.slice(cookie.length+1) || '';
    const [expires,mac] = value.split('.');
    if (!/^\d{13}$/.test(expires) || Number(expires)<=Date.now() || !/^[a-f0-9]{64}$/.test(mac || '') || !equal(Buffer.from(mac),Buffer.from(sign(expires)))) {
      return res.status(401).json({error:'Enter the board access key to continue.'});
    }
    next();
  });
  router.get('/',(req,res)=>{
    const projects = db.prepare('SELECT * FROM projects').all().map(p=>({...JSON.parse(p.details),revision:p.revision,files:[]}));
    const byId = new Map(projects.map(p=>[p.id,p]));
    for (const {projectId,id,name} of db.prepare('SELECT projectId,id,name FROM files').all()) byId.get(projectId).files.push({id,name});
    res.json({projects,locations:db.prepare('SELECT name FROM locations').all().map(row=>row.name)});
  });
  router.post('/locations',express.json(),(req,res)=>{
    db.prepare('INSERT OR IGNORE INTO locations VALUES (?)').run(textField(req.body.name,100,true));
    res.json({ok:true});
  });
  router.get('/projects/:project/files/:id',(req,res)=>{
    const row = db.prepare('SELECT name, contents FROM files WHERE projectId=? AND id=?').get(req.params.project,req.params.id);
    if (!row) return res.sendStatus(404);
    res.attachment(row.name).type('application/octet-stream').send(Buffer.from(row.contents));
  });
  router.put('/projects/:id',express.raw({type:'multipart/form-data',limit:'100mb'}),async(req,res,next)=>{
    try {
      if (!validId(req.params.id) || !Buffer.isBuffer(req.body)) reject(400,'Invalid project submission.');
      let form, data;
      try {
        form = await new Response(req.body,{headers:{'Content-Type':req.get('content-type')}}).formData();
        data = JSON.parse(form.get('project'));
      } catch { reject(400,'Invalid project form.'); }
      const id = req.params.id;
      const project = {id,title:textField(data.title,160,true),place:textField(data.place,100),stage:data.stage,notes:textField(data.notes,10000000)};
      if (!['Proposed','Approved','In Progress','Complete'].includes(project.stage)) reject(400,'Invalid stage.');
      const uploads = [];
      for (const [fileId,file] of form) {
        if (fileId==='project') continue;
        if (!validId(fileId) || typeof file === 'string' || !file.name || /[\x00-\x1f/\\]/.test(file.name) ||
          !(/\.(xlsx?|xlsm|xlsb|xltx?|xltm|csv|docx?|docm|dotx?|dotm|pdf|jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif|svg|ico)$/i.test(file.name) || file.type.startsWith('image/'))) reject(400,'Unsupported attachment.');
        uploads.push({id:fileId,name:file.name,bytes:Buffer.from(await file.arrayBuffer())});
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = db.prepare('SELECT revision,details FROM projects WHERE id=?').get(id);
        if (data.migrate && current) { db.exec('ROLLBACK'); return res.json({existing:true}); }
        if ((current?.revision || 0) !== data.revision) reject(409,'This project changed on the server. Reopen the board before saving.');
        const previous = current ? JSON.parse(current.details) : {};
        const links = Object.hasOwn(data,'links') ? data.links : previous.links || [];
        if (!Array.isArray(links)) reject(400,'Invalid purchase links.');
        project.links = links.map(link => {
          const label = textField(link?.label ?? '',160);
          let url;
          try { url = new URL(link?.url); } catch { reject(400,'Enter a valid retailer URL.'); }
          if (!['https:','http:'].includes(url.protocol)) reject(400,'Use an http or https retailer link.');
          return {label,url:url.href};
        });
        for (const field of ['cost','hours','complexity']) {
          const value = Object.hasOwn(data,field) ? data[field] : previous[field];
          if (value == null) continue;
          if (!Number.isFinite(value) || value < 0 || (field === 'complexity' && ![1,2,3].includes(value))) {
            reject(400,'Invalid estimate for ' + field + '.');
          }
          project[field] = value;
        }
        const revision = data.revision+1;
        db.prepare('INSERT OR REPLACE INTO projects VALUES (?,?,?)').run(id,JSON.stringify(project),revision);
        if (project.place) db.prepare('INSERT OR IGNORE INTO locations VALUES (?)').run(project.place);
        for (const fileId of data.removed || []) db.prepare('DELETE FROM files WHERE projectId=? AND id=?').run(id,fileId);
        for (const file of uploads) db.prepare('INSERT INTO files VALUES (?,?,?,?)').run(id,file.id,file.name,file.bytes);
        db.exec('COMMIT');
        res.json({revision});
      } catch(error) { db.exec('ROLLBACK'); throw error; }
    } catch(error) { next(error); }
  });
  router.use((error,req,res,next)=>{
    res.status(error.status || 500).json({error:error.status===413?'Attachments exceed the 100 MB limit per save.':error.status?error.message:'Server storage is unavailable.'});
  });
  return db;
};

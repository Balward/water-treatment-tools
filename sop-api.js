'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),model=require('./apps/sop-creator/model');
module.exports=function registerSOP(app,{directory=process.env.SOP_DATA_DIR||path.join(__dirname,'data','sops')}={}){
  let queue=Promise.resolve();
  const validId=id=>/^[a-zA-Z0-9-]{1,80}$/.test(id);
  const read=async id=>JSON.parse(await fs.readFile(path.join(directory,id+'.json'),'utf8'));
  app.use('/api/sops',(req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.get('/api/sops',async(req,res)=>{
    try{
      const files=await fs.readdir(directory).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
      const records=await Promise.all(files.filter(file=>/^[a-zA-Z0-9-]+\.json$/.test(file)).map(async file=>{
        const doc=await read(file.slice(0,-5));return {id:doc.id,title:doc.title,team:doc.team,tags:Array.isArray(doc.tags)?doc.tags.filter(tag=>model.tags.includes(tag)):[],revisedDate:model.revisedDate(doc),reviewedDate:model.reviewedDate(doc),effectiveDate:doc.effectiveDate,updatedAt:doc.updatedAt};
      }));
      res.json(records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
    }catch{res.status(500).json({error:'Unable to load the SOP library. Saved documents have not been changed.'});}
  });
  app.get('/api/sops/:id',async(req,res)=>{
    if(!validId(req.params.id))return res.status(400).json({error:'Invalid SOP identifier.'});
    try{res.json(await read(req.params.id));}catch(error){res.status(error.code==='ENOENT'?404:500).json({error:error.code==='ENOENT'?'SOP not found.':'Unable to read this SOP.'});}
  });
  app.put('/api/sops/:id',(req,res)=>{
    let origin;try{origin=new URL(req.headers.origin);}catch{}
    if(!origin||origin.host!==req.headers.host||!['http:','https:'].includes(origin.protocol))return res.status(403).json({error:'Save SOPs from the application page.'});
    let doc;try{doc=model.validate(req.body);if(doc.id!==req.params.id)throw Error('SOP identifiers do not match.');if(!doc.title.trim())throw Error('Enter a title before saving.');}catch(error){return res.status(400).json({error:error.message});}
    queue=queue.catch(()=>{}).then(async()=>{
      try{
        let previous;try{previous=await read(doc.id);}catch(error){if(error.code!=='ENOENT')throw error;}
        if(!previous){
          try{await fs.access(path.join(directory,'deleted',doc.id+'.json'));return res.status(410).json({error:'This SOP was deleted. Download a backup of your draft or import it as a new SOP.'});}
          catch(error){if(error.code!=='ENOENT')throw error;}
        }
        if(doc.revision!==(previous?.revision||0))return res.status(409).json({error:'This SOP was updated in another window. Your draft is still here. Download a backup before reopening the saved version.'});
        const next={...doc,revision:doc.revision+1,updatedAt:new Date().toISOString()};
        await fs.mkdir(directory,{recursive:true});
        if(previous){await fs.mkdir(path.join(directory,'history'),{recursive:true});await fs.writeFile(path.join(directory,'history',doc.id+'-'+previous.revision+'.json'),JSON.stringify(previous));}
        const target=path.join(directory,doc.id+'.json'),temp=target+'.tmp';
        await fs.writeFile(temp,JSON.stringify(next));await fs.rename(temp,target);
        res.json(next);
      }catch{res.status(500).json({error:'Unable to save this SOP. Your draft is still available; please try again.'});}
    });
  });
  app.delete('/api/sops/:id',(req,res)=>{
    let origin;try{origin=new URL(req.headers.origin);}catch{}
    if(!origin||origin.host!==req.headers.host||!['http:','https:'].includes(origin.protocol))return res.status(403).json({error:'Delete SOPs from the application page.'});
    if(!validId(req.params.id))return res.status(400).json({error:'Invalid SOP identifier.'});
    if(req.body?.confirmation!=='DELETE')return res.status(400).json({error:'Type DELETE to confirm deletion.'});
    queue=queue.catch(()=>{}).then(async()=>{
      try{
        let previous;try{previous=await read(req.params.id);}catch(error){if(error.code==='ENOENT')return res.status(404).json({error:'This SOP no longer exists. Close this window and refresh the library.'});throw error;}
        if(req.body.title!==previous.title||req.body.updatedAt!==previous.updatedAt)return res.status(409).json({error:'This SOP changed after you opened the library. Cancel, refresh the library, and confirm the updated SOP before deleting.'});
        await fs.mkdir(path.join(directory,'deleted'),{recursive:true});
        await fs.rename(path.join(directory,previous.id+'.json'),path.join(directory,'deleted',previous.id+'.json'));
        res.json({deleted:true,id:previous.id});
      }catch{res.status(500).json({error:'Unable to delete this SOP. Please try again.'});}
    });
  });
};

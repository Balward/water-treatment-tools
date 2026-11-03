'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto'),sets=require('./apps/application-review/hiring-reviews');
module.exports=function registerApplicationReview(app,{directory=process.env.APPLICATION_REVIEW_DATA_DIR||path.join(__dirname,'data','application-review')}={}){
  const file=path.join(directory,'review.json');let queue=Promise.resolve();
  const read=async()=>{try{return sets.validate(JSON.parse(await fs.readFile(file,'utf8')));}catch(error){if(error.code==='ENOENT')return sets.blank();throw error;}};
  const get=(route,project)=>app.get(route,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(project(await read(),req));}catch(error){res.status(error.status||500).json({error:error.status?error.message:'Unable to read saved hiring reviews. Existing data has not been replaced.'});}});
  get('/api/application-review/sets',current=>sets.summary(current));
  get('/api/application-review/sets/:id',(current,req)=>{if(!current.sets.some(s=>s.id===req.params.id))throw Object.assign(Error('Hiring review not found.'),{status:404});return sets.response(current,req.params.id);});
  // Older pages remain scoped to the original review after migration.
  get('/api/application-review',current=>sets.response(current,sets.originalId).review);
  function post(route,mode){app.post(route,(req,res)=>{
    res.set('Cache-Control','no-store');
    queue=queue.catch(()=>{}).then(async()=>{
      try {
        let origin;try{origin=new URL(req.headers.origin);}catch{}if(!origin||origin.host!==req.headers.host||!['http:','https:'].includes(origin.protocol))return res.status(403).json({error:'Save reviews from the application page.'});
        let current;try{current=await read();}catch{return res.status(500).json({error:'Saved review data could not be read. No changes were made.'});}
        const id=mode==='legacy'?sets.originalId:mode==='create'?'review-'+randomUUID():req.params.id;
        if(mode!=='create'&&req.body.type==='create-set')return res.status(400).json({error:'Create a hiring review from the hiring review list.'});
        let next;try{next=sets.apply(current,mode==='create'?{...req.body,type:'create-set'}:{...req.body,setId:id},undefined,id);}catch(error){return res.status(error.status||400).json({error:error.message});}
        await fs.mkdir(directory,{recursive:true});
        // Keep the previous valid state for recovery, including before imports.
        try{const previous=await fs.readFile(file,'utf8').catch(error=>{if(error.code==='ENOENT')return JSON.stringify(current);throw error;});await fs.writeFile(path.join(directory,'before-'+next.revision+'.json'),previous,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
        const temporary=file+'.tmp';await fs.writeFile(temporary,JSON.stringify(next,null,2));await fs.rename(temporary,file);
        const result=sets.response(next,id);res.status(mode==='create'?201:200).json(mode==='legacy'?result.review:result);
      }catch(error){console.error('Application review storage error:',error.code||error.message);res.status(500).json({error:'Unable to save. Reload to verify the saved version before retrying.'});}
    });
  });}
  post('/api/application-review/sets','create');post('/api/application-review/sets/:id','set');post('/api/application-review','legacy');
};

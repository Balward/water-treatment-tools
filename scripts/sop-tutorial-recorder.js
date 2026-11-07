/* Runs only inside the local tutorial build browser. */
window.recordingStatus='ready';window.recorderReady=true;
window.startTutorialRecording=()=>{(async()=>{try{
  const steps=await(await fetch('./tutorial-assets/steps.json')).json();
  const images=await Promise.all(steps.map(s=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='./tutorial-assets/'+s.image;})));
  const total=steps.at(-1).start+steps.at(-1).duration,canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),stream=canvas.captureStream(24);
  const audio=new AudioContext();await audio.resume();
  const response=await fetch('/tutorial-music');if(!response.ok)throw Error('Music could not be loaded');
  const buffer=await audio.decodeAudioData(await response.arrayBuffer()),source=audio.createBufferSource(),gain=audio.createGain(),destination=audio.createMediaStreamDestination();
  if(!buffer.getChannelData(0).some(value=>Math.abs(value)>.001))throw Error('Music contains no audible samples');
  source.buffer=buffer;source.loop=true;source.connect(gain);gain.connect(destination);
  gain.gain.setValueAtTime(0,audio.currentTime);gain.gain.linearRampToValueAtTime(.3,audio.currentTime+2);gain.gain.setValueAtTime(.3,audio.currentTime+total-3);gain.gain.linearRampToValueAtTime(0,audio.currentTime+total);
  for(const track of destination.stream.getAudioTracks())stream.addTrack(track);
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm;codecs=vp8,opus';
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2200000,audioBitsPerSecond:128000}),chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=async()=>{source.stop();stream.getTracks().forEach(t=>t.stop());await audio.close();const r=await fetch('/tutorial-video',{method:'POST',headers:{'Content-Type':'video/webm'},body:new Blob(chunks,{type:'video/webm'})});window.recordingStatus=r.ok?'done':'error:Upload failed';};
  function wrap(text,x,y,maxWidth,lineHeight){let line='';for(const word of text.split(' ')){const next=line+word+' ';if(ctx.measureText(next).width>maxWidth){ctx.fillText(line,x,y);line=word+' ';y+=lineHeight;}else line=next;}ctx.fillText(line,x,y);}
  const started=performance.now();recorder.start(1000);source.start();window.recordingStatus='recording';
  function frame(){
    const elapsed=(performance.now()-started)/1000,index=Math.max(0,steps.findLastIndex(step=>step.start<=elapsed)),step=steps[index],phase=elapsed-step.start,scale=1280/1440;
    ctx.fillStyle='#edf2f4';ctx.fillRect(0,0,1280,1080);ctx.drawImage(images[index],0,0,1280,800);
    const x=step.point.x*scale,y=step.point.y*scale,pulse=(phase%2)/2;
    ctx.fillStyle='rgba(255,168,0,.28)';ctx.beginPath();ctx.arc(x,y,28,0,Math.PI*2);ctx.fill();
    for(const [radius,color,width] of [[29,'#fff',10],[29,'#d84800',6],[32+pulse*26,'rgba(216,72,0,'+(1-pulse)+')',5]]){ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
    ctx.save();ctx.translate(x+4,y+4);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,34);ctx.lineTo(9,25);ctx.lineTo(17,41);ctx.lineTo(25,37);ctx.lineTo(17,21);ctx.lineTo(30,21);ctx.closePath();ctx.fillStyle='#172127';ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.fill();ctx.stroke();ctx.restore();
    ctx.fillStyle='#172127';ctx.fillRect(0,800,1280,280);ctx.fillStyle='#fff';ctx.font='bold 25px sans-serif';ctx.fillText((index+1)+' / '+steps.length+'   '+step.title,30,839);ctx.font='22px sans-serif';wrap(step.text,30,880,1220,30);
    // Reserve the bottom 110px so playback controls cannot cover instructions.
    ctx.fillStyle='#9fb5c0';ctx.font='16px sans-serif';ctx.fillText('Pause whenever needed  •  '+step.duration+' seconds per step',30,965);
    ctx.fillStyle='#24a9c4';ctx.fillRect(0,1075,1280*Math.min(1,elapsed/total),5);
    window.recordingSeconds=Math.floor(elapsed);
    if(elapsed<total)requestAnimationFrame(frame);else recorder.stop();
  }
  frame();
}catch(error){window.recordingStatus='error:'+error.message;}})();};

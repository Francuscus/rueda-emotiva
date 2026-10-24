'use strict';

const families = [
  {id:'joy', hue:50, names:['Éxtasis','Alegría','Serenidad'], work:'Bernstein · Mambo', query:'Bernstein Mambo Dudamel BBC Proms', notes:[60,64,67,72,69,67,64,67], beat:.24},
  {id:'trust', hue:94, names:['Admiración','Confianza','Aceptación'], work:'Holst · Jupiter, himno central', query:'Holst Jupiter central hymn orchestra', notes:[48,55,60,64,67,64,60,55], beat:.8},
  {id:'fear', hue:151, names:['Terror','Miedo','Aprensión'], work:'Bartók · Música para cuerdas, percusión y celesta, III', query:'Bartok Music Strings Percussion Celesta III Adagio', notes:[36,37,48,42,37,49,36,38], beat:.62},
  {id:'surprise', hue:192, names:['Asombro','Sorpresa','Distracción'], work:'R. Strauss · Also sprach Zarathustra, Sunrise', query:'Richard Strauss Also sprach Zarathustra Sunrise', notes:[48,55,60,72,64,76,67,79], beat:.48},
  {id:'sadness', hue:231, names:['Aflicción','Tristeza','Melancolía'], work:'Barber · Adagio for Strings', query:'Barber Adagio for Strings Detroit Symphony', notes:[57,60,64,62,60,59,57,52], beat:.95},
  {id:'disgust', hue:280, names:['Repugnancia','Asco','Aburrimiento'], work:'Eric Dolphy · Hat and Beard', query:'Eric Dolphy Hat and Beard Out to Lunch', notes:[46,59,48,61,45,56,50,63], beat:.34},
  {id:'anger', hue:355, names:['Furia','Ira','Molestia'], work:'Holst · Mars, the Bringer of War', query:'Holst Mars Bringer of War orchestra', notes:[36,36,43,37,36,48,43,37], beat:.22},
  {id:'anticipation', hue:26, names:['Vigilancia','Anticipación','Interés'], work:'John Williams · Jaws, Main Title', query:'John Williams Jaws Main Title official audio', notes:[40,41,40,41,40,43,40,41], beat:.46}
];
const musicLinks = {"joy":"https://www.youtube.com/watch?v=-8wS-1Eqonk","fear":"https://www.youtube.com/watch?v=ea_pWmfLlqE","surprise":"https://www.youtube.com/watch?v=9K3GQdD30F0","sadness":"https://www.youtube.com/watch?v=N3MHeNt6Yjs","anger":"https://www.youtube.com/watch?v=1sUwBcJ5Atw","anticipation":"https://www.youtube.com/watch?v=BePfzCOMRZQ"};
function recommendation(id) {
  const f=family(id),direct=musicLinks[id];
  return {url:direct||'https://www.youtube.com/results?search_query='+encodeURIComponent(f.query),label:(direct?'Escuchar en YouTube: ':'Buscar en YouTube: ')+f.work};
}
function showRecommendation(id) {
  const link=recommendation(id);
  $('suggestedTrackLink').href=link.url;
  $('suggestedTrackLink').textContent=link.label+' ↗';
  $('suggestedTrack').hidden=false;
}
const $ = id => document.getElementById(id);
let mode='explore', selected=null, choice=null, revealed=false, active=false, recording=false, busy=false;
let ctx, musicBus, monitorGain, mixGain, voiceGain, compressor, mixedDestination, voiceDestination, source, micStream, micNode;
let mixedRecorder, voiceRecorder, timerHandle, startedAt, db=null, custom=[], takes=[], loadSequence=0;
const sketchCache=new Map();
function message(text){$('status').textContent=text;}
function fail(error){console.error(error);message(error.name==='NotAllowedError'?'Permite el micrófono en los ajustes del sitio y vuelve a intentarlo.':error.message || 'No se pudo completar la operación.');}
function guard(fn){return (...args)=>Promise.resolve().then(()=>fn(...args)).catch(fail);}
function family(id){return families.find(f=>f.id===id);}
function point(r,angle){let a=angle*Math.PI/180;return [320+r*Math.cos(a),320+r*Math.sin(a)];}
function sector(inner,outer,a,b){const p=point(outer,a),q=point(outer,b),s=point(inner,b),t=point(inner,a);return `M ${p} A ${outer} ${outer} 0 0 1 ${q} L ${s} A ${inner} ${inner} 0 0 0 ${t} Z`;}
function svgNode(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);return el;}
function drawWheel(){
  const svg=$('wheel');const rings=[[48,132],[132,218],[218,305]];
  families.forEach((f,i)=>rings.forEach(([inner,outer],level)=>{
    const angle=-90+i*45,a=angle-22.5,b=angle+22.5;
    const g=svgNode('g',{class:'wedge',role:'button',tabindex:'0','aria-label':`${f.names[level]}, intensidad ${3-level}`,'aria-pressed':'false','data-family':f.id,'data-level':level});
    const p=svgNode('path',{d:sector(inner,outer,a,b),fill:`hsl(${f.hue} ${level===0?67:63}% ${[53,65,78][level]}%)`});g.append(p);
    const [x,y]=point((inner+outer)/2,angle);let rotation=angle+90;if(rotation>90&&rotation<270)rotation+=180;
    const t=svgNode('text',{x,y,'text-anchor':'middle','dominant-baseline':'middle',transform:`rotate(${rotation} ${x} ${y})`});t.textContent=f.names[level];g.append(t);
    const activate=guard(()=>wheelClick(f.id,level));g.addEventListener('click',activate);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});svg.append(g);
  }));
  const center=svgNode('circle',{cx:320,cy:320,r:42,fill:'#242135'});svg.append(center);const t=svgNode('text',{x:320,y:325,'text-anchor':'middle',fill:'#e1c8ff','font-size':12,'font-family':'system-ui'});t.textContent='SIENTE';svg.append(t);
}
function highlight(id,level){document.querySelectorAll('.wedge').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.family===id&&Number(el.dataset.level)===level)));}
async function wheelClick(id,level){
  if(busy)return;
  if(mode==='challenge'){
    $('guess').textContent=`El público propone: ${family(id).names[level]}.`;
    highlight(id,level);return;
  }
  if(recording)return;
  selected={id,level};highlight(id,level);
  const pool=await candidates(id);if(!pool.length)throw new Error('Añade un pasaje para esta familia o activa los bocetos de demostración.');
  await playChoice(pool[Math.floor(Math.random()*pool.length)],level);
}
function audioSetup(){
  if(ctx)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Este navegador no permite procesar audio. Prueba Chrome, Edge, Firefox o Safari actualizado.');
  ctx=new Audio();musicBus=ctx.createGain();monitorGain=ctx.createGain();mixGain=ctx.createGain();voiceGain=ctx.createGain();compressor=ctx.createDynamicsCompressor();
  mixedDestination=ctx.createMediaStreamDestination();voiceDestination=ctx.createMediaStreamDestination();
  musicBus.connect(monitorGain);monitorGain.connect(ctx.destination);
  musicBus.connect(mixGain);mixGain.connect(compressor);voiceGain.connect(compressor);voiceGain.connect(voiceDestination);compressor.connect(mixedDestination);
  updateGains();
}
function updateGains(){if(!ctx)return;monitorGain.gain.setTargetAtTime(Number($('monitorLevel').value),ctx.currentTime,.03);mixGain.gain.setTargetAtTime(Number($('musicLevel').value),ctx.currentTime,.03);voiceGain.gain.setTargetAtTime(Number($('voiceLevel').value),ctx.currentTime,.03);}
async function sketch(id,variant){
  const key=id+variant;if(sketchCache.has(key))return sketchCache.get(key);
  const f=family(id), length=32, sampleRate=22050, offline=new OfflineAudioContext(1,length*sampleRate,sampleRate);
  const out=offline.createGain();out.gain.value=.45;out.connect(offline.destination);
  let t=.05,index=0;while(t<length-.8){
    const note=f.notes[(index+(variant?3:0))%f.notes.length]+(variant?5:0);
    const duration=['trust','sadness'].includes(id)?f.beat*1.8:f.beat*.8;
    const osc=offline.createOscillator(),g=offline.createGain();osc.type=['fear','anger'].includes(id)?'sawtooth':'sine';
    osc.frequency.value=440*2**((note-69)/12);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    osc.connect(g);g.connect(out);osc.start(t);osc.stop(Math.min(length,t+duration+.02));
    if(['trust','joy','sadness'].includes(id)){
      const chord=offline.createOscillator(),cg=offline.createGain();chord.frequency.value=osc.frequency.value*1.5;cg.gain.setValueAtTime(.025,t);cg.gain.exponentialRampToValueAtTime(.001,t+duration);chord.connect(cg);cg.connect(out);chord.start(t);chord.stop(Math.min(length,t+duration+.02));
    }
    t+=f.beat*(id==='disgust'?[1,.5,1.5,.75][index%4]:1);index++;
  }
  const buffer=await offline.startRendering();sketchCache.set(key,buffer);return buffer;
}
async function candidates(id=null){
  let pool=custom.filter(p=>!id||p.family===id).map(p=>({...p,kind:'file'}));
  if($('demos').checked)for(const f of families.filter(f=>!id||f.id===id))for(let v=0;v<2;v++)pool.push({kind:'demo',family:f.id,variant:v,title:`Boceto original ${v+1} · ${f.names[0]}`});
  return pool;
}
function stopSource(){if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}active=false;}
function stopMusic(){if(recording||busy)return;loadSequence++;stopSource();renderControls();message('Música detenida.');}
async function playChoice(p,level=0){
  const token=++loadSequence;busy=true;renderControls();stopSource();message('Preparando audio…');
  try{
    audioSetup();await ctx.resume();
    const buffer=p.kind==='demo'?await sketch(p.family,p.variant):await ctx.decodeAudioData(await p.blob.arrayBuffer());
    if(token!==loadSequence)return;
    const start=p.start||0,end=p.end==null?buffer.duration:Math.min(p.end,buffer.duration);
    if(end<=start)throw new Error('El fragmento no contiene audio. Revisa inicio y final.');
    choice={...p,level,roundId:crypto.randomUUID()};revealed=mode==='explore';selected={id:p.family,level};
    source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=start;source.loopEnd=end;source.connect(musicBus);source.start(0,start);active=true;
    if(mode==='explore'){
      showRecommendation(p.family);$('studioHeading').textContent=family(p.family).names[level];$('trackInfo').textContent=p.title+' · El fragmento se repite hasta detenerlo.';
    }else{
      $('suggestedTrack').hidden=true;$('studioHeading').textContent='Escucha. Deja que cambie tu voz.';$('trackInfo').textContent='Pasaje oculto. Escucha unos segundos y después graba tu poema.';
      $('guess').textContent='Público: elige una emoción en la rueda.';highlight(null,null);
    }
    message(p.kind==='demo'&&mode==='explore'?'Escuchando un boceto sintético de demostración.':'Música en reproducción. Puedes empezar a grabar.');
  }finally{busy=false;renderControls();}
}
async function randomPassage(){
  if(recording||busy)return;if(!$('headphones').checked)throw new Error('Confirma primero que tienes los auriculares conectados.');
  const pool=await candidates();if(!pool.length)throw new Error('Añade archivos o activa los bocetos de demostración.');
  await playChoice(pool[Math.floor(Math.random()*pool.length)]);
}
function renderControls(){
  $('exploreMode').disabled=recording||busy;$('challengeMode').disabled=recording||busy;
  $('random').disabled=recording||busy;$('stopMusic').disabled=!active||recording||busy;
  $('record').disabled=!active||recording||busy;$('finish').disabled=!recording;
  $('reveal').disabled=!choice||recording||busy||revealed;
  $('record').classList.toggle('recording',recording);
}
function setMode(next){
  if(recording||busy)return;loadSequence++;stopSource();choice=null;selected=null;revealed=false;mode=next;$('suggestedTrack').hidden=true;$('musicResources').hidden=mode==='challenge';
  $('exploreMode').setAttribute('aria-pressed',String(mode==='explore'));$('challengeMode').setAttribute('aria-pressed',String(mode==='challenge'));
  $('random').hidden=mode!=='challenge';$('challengeInstructions').hidden=mode!=='challenge';$('guessPanel').hidden=mode!=='challenge';
  $('badge').textContent=mode==='explore'?'Exploración':'Reto a ciegas';$('wheelHeading').textContent=mode==='explore'?'Elige una emoción':'¿Qué emoción escuchas en su voz?';$('wheelHint').textContent=mode==='explore'?'Haz clic para escuchar':'Haz clic para adivinar';
  $('studioHeading').textContent=mode==='explore'?'Tu próxima emoción empieza con un clic.':'Una música secreta. Tu interpretación.';
  $('trackInfo').textContent=mode==='explore'?'Haz clic en la rueda para escuchar. Los bocetos de demostración se pueden sustituir por tus propios archivos.':'La selección se mantiene oculta hasta que pulses «Revelar emoción y pasaje».';
  $('guess').textContent='Público: elige una emoción en la rueda.';highlight(null,null);renderControls();message(mode==='explore'?'Listo para explorar.':'Conecta los auriculares y elige un pasaje al azar.');
}
function supportedMime(){return ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));}
function recorderFor(stream){const mime=supportedMime();return new MediaRecorder(stream,mime?{mimeType:mime}:undefined);}
function stopMic(){if(micNode){micNode.disconnect();micNode=null;}if(micStream){for(const track of micStream.getTracks()){track.onended=null;track.stop();}micStream=null;}}
async function startRecording(){
  if(!active||recording||busy)return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('El micrófono necesita una página HTTPS. Abre la aplicación publicada en GitHub Pages.');
  if(!window.MediaRecorder)throw new Error('Este navegador no permite grabar audio. Prueba un navegador actualizado.');
  busy=true;renderControls();document.querySelectorAll('audio').forEach(a=>a.pause());
  try{
    audioSetup();await ctx.resume();micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    micNode=ctx.createMediaStreamSource(micStream);micNode.connect(voiceGain);
    mixedRecorder=recorderFor(mixedDestination.stream);voiceRecorder=recorderFor(voiceDestination.stream);
    const mixed=[],voice=[],takeChoice={...choice},poem=$('poem').value;
    mixedRecorder.ondataavailable=e=>{if(e.data.size)mixed.push(e.data);};voiceRecorder.ondataavailable=e=>{if(e.data.size)voice.push(e.data);};
    let stopped=0,recorderError=false;
    const done=()=>{if(++stopped<2)return;busy=false;renderControls();if(recorderError){message('La grabación falló. Vuelve a intentar una toma.');return;}if(!mixed.length||!voice.length){message('No se recibió audio. Comprueba el micrófono y vuelve a intentar.');return;}
      const take={id:Date.now(),choice:takeChoice,poem,duration:Math.max(1,Math.round((performance.now()-startedAt)/1000)),revealed:mode==='explore'||revealed,
        mixed:new Blob(mixed,{type:mixedRecorder.mimeType||mixed[0].type}),voice:new Blob(voice,{type:voiceRecorder.mimeType||voice[0].type})};
      takes.unshift(take);renderTakes();message('Toma lista. Descárgala para conservarla.');};
    mixedRecorder.onstop=done;voiceRecorder.onstop=done;
    for(const rec of [mixedRecorder,voiceRecorder])rec.onerror=()=>{recorderError=true;finishRecording();message('Error de grabación. Revisa el micrófono y vuelve a intentarlo.');};
    mixedRecorder.start(250);voiceRecorder.start(250);recording=true;startedAt=performance.now();
    for(const track of micStream.getTracks())track.onended=()=>{finishRecording();message('Se desconectó el micrófono. La toma se ha detenido.');};
    timerHandle=setInterval(()=>{const elapsed=Math.floor((performance.now()-startedAt)/1000);$('timer').textContent=formatTime(elapsed);if(elapsed>=300)finishRecording();},250);
    message('Grabando voz + música. Recita tu poema. Máximo: 5 minutos.');
  }catch(e){for(const rec of [mixedRecorder,voiceRecorder])if(rec?.state==='recording')rec.stop();stopMic();stopSource();throw e;}
  finally{busy=false;renderControls();}
}
function finishRecording(){
  if(!recording)return;recording=false;busy=true;clearInterval(timerHandle);
  for(const rec of [mixedRecorder,voiceRecorder])if(rec?.state==='recording')rec.stop();
  stopSource();stopMic();renderControls();message('Preparando tu interpretación…');
}
function formatTime(s){return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;}
function reveal(){
  if(!choice||recording||busy)return;revealed=true;showRecommendation(choice.family);$('musicResources').hidden=false;
  $('studioHeading').textContent=family(choice.family).names[choice.level];$('trackInfo').textContent=choice.title;highlight(choice.family,choice.level);
  for(const t of takes)if(t.choice.roundId===choice.roundId)t.revealed=true;
  renderTakes();renderControls();message('Emoción revelada. Escucha la interpretación con el público.');
}
function ext(blob){return blob.type.includes('mp4')?'m4a':blob.type.includes('ogg')?'ogg':'webm';}
function renderTakes(){
  $('emptyTakes').hidden=takes.length>0;const list=$('takeList');
  for(const a of list.querySelectorAll('audio')){a.pause();URL.revokeObjectURL(a.src);}list.replaceChildren();
  takes.forEach((t,index)=>{
    const box=document.createElement('article');box.className='take';const heading=document.createElement('h3');heading.textContent=`Toma ${takes.length-index} · ${t.revealed?family(t.choice.family).names[t.choice.level]:'Emoción oculta'} · ${formatTime(t.duration)}`;box.append(heading);
    const info=document.createElement('p');info.className='caption';info.textContent=t.revealed?t.choice.title:'Revela el pasaje después de las respuestas del público.';box.append(info);
    function version(blob,label){const wrap=document.createElement('div'),l=document.createElement('label'),audio=document.createElement('audio'),link=document.createElement('a');l.textContent=label;audio.controls=true;audio.preload='metadata';audio.src=URL.createObjectURL(blob);audio.addEventListener('play',()=>{if(recording||busy){audio.pause();return;}if(active)stopMusic();document.querySelectorAll('audio').forEach(other=>{if(other!==audio)other.pause();});});link.href=audio.src;link.download=`rueda-emotiva-${t.id}-${label==='Voz sola'?'voz':'mezcla'}.${ext(blob)}`;link.textContent=`Descargar ${label.toLowerCase()}`;wrap.append(l,audio,link);return wrap;}
    box.append(version(t.mixed,'Voz + música'));if(!t.revealed){const show=document.createElement('button');show.textContent='Revelar esta toma';show.onclick=()=>{if(recording||busy)return;t.revealed=true;renderTakes();};box.append(show);}const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Escuchar la voz sola / ver el texto';details.append(summary,version(t.voice,'Voz sola'));const text=document.createElement('p');text.style.whiteSpace='pre-wrap';text.textContent=t.poem;details.append(text);box.append(details);
    const remove=document.createElement('button');remove.textContent='Eliminar toma';remove.disabled=recording;remove.onclick=()=>{takes=takes.filter(x=>x!==t);renderTakes();};box.append(remove);list.append(box);
  });
}

// Local music storage. No microphone data is uploaded or persisted automatically.
function openDB(){return new Promise((resolve,reject)=>{const request=indexedDB.open('rueda-emotiva',1);request.onupgradeneeded=()=>request.result.createObjectStore('passages',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function dbAll(){return new Promise((resolve,reject)=>{const req=db.transaction('passages').objectStore('passages').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function dbWrite(p,remove=false){return new Promise((resolve,reject)=>{const tx=db.transaction('passages','readwrite');if(remove)tx.objectStore('passages').delete(p.id);else tx.objectStore('passages').put(p);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('No se pudo guardar.'));});}
async function addPassage(p){let stored=false;if(db){try{await dbWrite(p);stored=true;}catch{}}custom.push(p);return stored;}
async function upload(e){
  e.preventDefault();if(busy||recording)return;
  const files=[...$('audioFiles').files];if(!files.length)return;
  const start=Number($('clipStart').value),rawEnd=$('clipEnd').value,end=rawEnd===''?null:Number(rawEnd);
  if(!Number.isFinite(start)||start<0||end!==null&&(!Number.isFinite(end)||end<=start))throw new Error('El final debe ser posterior al inicio.');
  busy=true;renderControls();let count=0,allStored=true;
  try{audioSetup();for(const file of files){
    if(file.size>40*1024*1024)throw new Error('Cada archivo debe ocupar menos de 40 MB. Recorta el audio antes de añadirlo.');
    const buffer=await ctx.decodeAudioData(await file.arrayBuffer());if(start>=buffer.duration||end!==null&&end>buffer.duration+.05)throw new Error(`El fragmento indicado queda fuera de «${file.name}» (${buffer.duration.toFixed(1)} s).`);
    const p={id:crypto.randomUUID(),family:$('familySelect').value,title:file.name,blob:file,start,end:end??buffer.duration};allStored=(await addPassage(p))&&allStored;count++;
  }$('audioFiles').value='';$('libraryStatus').textContent=`${count} pasaje(s) añadido(s). ${allStored?'Guardados en este navegador.':'Solo en esta sesión: exporta la colección para conservarla.'}`;
  }finally{busy=false;renderControls();renderLibrary();}
}
function renderLibrary(){
  const list=$('passageList');list.replaceChildren();
  if(!custom.length){const p=document.createElement('p');p.className='caption';p.textContent='Todavía no has añadido archivos de audio.';list.append(p);}
  for(const p of custom){const row=document.createElement('div');row.className='passage';const label=document.createElement('span');label.textContent=`${family(p.family).names[0]} · ${p.title} · ${p.start.toFixed(1)}–${p.end.toFixed(1)} s`;
    const remove=document.createElement('button');remove.textContent='Quitar';remove.onclick=guard(async()=>{if(db)try{await dbWrite(p,true);}catch{throw new Error('No se pudo eliminar el pasaje guardado.');}custom=custom.filter(x=>x.id!==p.id);renderLibrary();});row.append(label,remove);list.append(row);}
}
function blobBase64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportLibrary(){if(!custom.length)throw new Error('Añade al menos un archivo antes de exportar.');if(custom.reduce((n,p)=>n+p.blob.size,0)>100*1024*1024)throw new Error('La colección supera 100 MB. Reduce el tamaño de los archivos antes de exportar.');const passages=[];for(const p of custom){const {blob,...meta}=p;passages.push({...meta,type:blob.type,audio:await blobBase64(blob)});}downloadBlob(new Blob([JSON.stringify({version:1,passages})],{type:'application/json'}),'rueda-emotiva-coleccion.json');}
async function importLibrary(){
  if(recording||busy)return;const file=$('importLibrary').files[0];if(!file)return;if(file.size>140*1024*1024)throw new Error('La colección es demasiado grande. Máximo: 140 MB.');
  busy=true;renderControls();let allStored=true,count=0;
  try{const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.passages)||data.passages.length>100)throw new Error('Colección no válida (máximo 100 pasajes).');audioSetup();
    for(const p of data.passages){
      if(!family(p.family)||typeof p.audio!=='string'||typeof p.title!=='string'||!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start<0||p.end<=p.start)throw new Error('Hay un pasaje no válido en la colección.');
      const bytes=Uint8Array.from(atob(p.audio),c=>c.charCodeAt(0));if(bytes.length>40*1024*1024)throw new Error('Un archivo supera 40 MB.');const blob=new Blob([bytes],{type:typeof p.type==='string'?p.type:'audio/mpeg'});const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());if(p.end>decoded.duration+.05)throw new Error('Un fragmento supera la duración del audio.');
      allStored=(await addPassage({id:crypto.randomUUID(),family:p.family,title:p.title.slice(0,200),start:p.start,end:p.end,blob}))&&allStored;count++;
    }$('libraryStatus').textContent=`${count} pasaje(s) importado(s). ${allStored?'Guardados en este navegador.':'Solo disponibles en esta sesión; conserva el archivo exportado.'}`;
  }finally{busy=false;$('importLibrary').value='';renderControls();renderLibrary();}
}
async function init(){
  drawWheel();families.forEach(f=>{const option=document.createElement('option');option.value=f.id;option.textContent=`${f.names[0]} / ${f.names[1]}`;$('familySelect').append(option);
    const a=document.createElement('a');const recommended=recommendation(f.id);a.href=recommended.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=f.names[0];const span=document.createElement('span');span.textContent=f.work+' · '+(musicLinks[f.id]?'Escuchar':'Buscar en YouTube')+' ↗';a.append(span);$('suggestions').append(a);});
  try{db=await openDB();custom=await dbAll();}catch{$('libraryStatus').textContent='El almacenamiento local no está disponible. Puedes cargar audio para esta sesión y exportar tu colección.';}
  renderLibrary();renderControls();
}
$('exploreMode').onclick=()=>setMode('explore');$('challengeMode').onclick=()=>setMode('challenge');$('random').onclick=guard(randomPassage);$('stopMusic').onclick=stopMusic;$('record').onclick=guard(startRecording);$('finish').onclick=finishRecording;$('reveal').onclick=reveal;
for(const id of ['monitorLevel','musicLevel','voiceLevel'])$(id).oninput=updateGains;
$('uploadForm').onsubmit=guard(upload);$('exportLibrary').onclick=guard(exportLibrary);$('importLibrary').onchange=guard(importLibrary);
window.addEventListener('beforeunload',e=>{if(recording||takes.length){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{if(recording)finishRecording();stopMic();stopSource();});
init().catch(fail);

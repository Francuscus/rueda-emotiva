const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const code=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');

function harness(){
  const elements=new Map(),wedges=[],nodes=[];
  function element(){return {value:'',checked:true,hidden:false,disabled:false,textContent:'',dataset:{},style:{},children:[],classList:{toggle(){}},setAttribute(k,v){this[k]=v;if(k==='data-family')this.dataset.family=v;if(k==='data-level')this.dataset.level=String(v);},addEventListener(){},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},querySelectorAll(){return [];},pause(){},click(){}};}
  const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,createElementNS(ns,tag){const e=element();if(tag==='g')wedges.push(e);return e;},querySelectorAll(selector){return selector==='.wedge'?wedges:[];}};
  document.getElementById('monitorLevel').value='.45';document.getElementById('musicLevel').value='.22';document.getElementById('voiceLevel').value='1';
  class AudioNode{constructor(type){this.type=type;this.outputs=[];this.gain={setTargetAtTime(v){this.value=v;}};nodes.push(this);}connect(other){this.outputs.push(other);}disconnect(){this.outputs=[];}}
  class AudioContext{constructor(){this.destination=new AudioNode('speakers');this.currentTime=0;}createGain(){return new AudioNode('gain');}createDynamicsCompressor(){return new AudioNode('compressor');}createMediaStreamDestination(){const n=new AudioNode('recorder');n.stream={};return n;}createMediaStreamSource(){return new AudioNode('microphone');}resume(){return Promise.resolve();}}
  class MediaRecorder{static isTypeSupported(t){return t.startsWith('audio/webm');}constructor(stream,options){this.state='inactive';this.mimeType=options?.mimeType||'audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['test'],{type:this.mimeType})});queueMicrotask(()=>this.onstop?.());}}
  let stopped=false;const track={stop(){stopped=true;},onended:null};
  const sandbox={fetch:async()=>({ok:true,json:async()=>({version:1,passages:[]})}),document,console,AudioContext,MediaRecorder,Blob,URL,crypto:webcrypto,performance,setInterval,clearInterval,setTimeout,queueMicrotask,navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track]})}},indexedDB:{open(){throw new Error('unavailable');}},addEventListener(){},isSecureContext:true};
  sandbox.window=sandbox;
  vm.createContext(sandbox);vm.runInContext(code.replace('init().catch(fail);','drawWheel();'),sandbox);
  return {run:s=>vm.runInContext(s,sandbox),document,wedges,nodes,micStopped:()=>stopped};
}
test('wheel has 24 keyboard-accessible sectors, three intensities, correct opposites',()=>{
  const h=harness();assert.equal(h.wedges.length,24);assert.ok(h.wedges.every(w=>w.role==='button'&&w.tabindex==='0'));
  assert.equal(h.run('families[0].id'), 'joy');assert.equal(h.run('families[4].id'),'sadness');
  assert.equal(h.run('families[1].id'),'trust');assert.equal(h.run('families[5].id'),'disgust');
  assert.equal(h.run('families[2].id'),'fear');assert.equal(h.run('families[6].id'),'anger');
  assert.equal(h.run('families[3].id'),'surprise');assert.equal(h.run('families[7].id'),'anticipation');
});
test('microphone has no path to speaker output, but reaches both recording streams',()=>{
  const h=harness();h.run('audioSetup()');
  function reaches(start,target,seen=new Set()){if(start===target)return true;if(seen.has(start))return false;seen.add(start);return start.outputs.some(n=>reaches(n,target,seen));}
  const voice=h.run('voiceGain'),music=h.run('musicBus'),speakers=h.run('ctx.destination');
  assert.equal(reaches(voice,speakers),false);assert.equal(reaches(music,speakers),true);
  assert.equal(reaches(voice,h.run('voiceDestination')),true);assert.equal(reaches(voice,h.run('mixedDestination')),true);
  assert.equal(reaches(music,h.run('voiceDestination')),false);assert.equal(reaches(music,h.run('mixedDestination')),true);
});
test('recording stops music, releases microphone, and creates voice and mixed downloads',async()=>{
  const h=harness();h.run("audioSetup();active=true;choice={family:'joy',level:0,title:'Demo',roundId:'one'}");await h.run('startRecording()');assert.equal(h.run('recording'),true);
  h.run('finishRecording()');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.run('recording'),false);assert.equal(h.run('busy'),false);assert.equal(h.run('active'),false);assert.equal(h.micStopped(),true);
  assert.equal(h.run('takes.length'),1);assert.ok(h.run('takes[0].voice.size')>0);assert.ok(h.run('takes[0].mixed.size')>0);
});
test('reveal only reveals takes belonging to the current challenge',()=>{
  const h=harness();h.run("choice={family:'fear',level:0,title:'Hidden',roundId:'new'};takes=[{choice:{roundId:'old'},revealed:false},{choice:{roundId:'new'},revealed:false}];renderTakes=()=>{};reveal()");
  assert.equal(h.run('takes[0].revealed'),false);assert.equal(h.run('takes[1].revealed'),true);
});
test('challenge wheel guesses do not start or change the music',async()=>{
  const h=harness();h.run("mode='challenge';choice={family:'fear',roundId:'same'}");await h.run("wheelClick('joy',0)");assert.equal(h.run('choice.family'),'fear');assert.equal(h.run('active'),false);assert.match(h.document.getElementById('guess').textContent,/Éxtasis/);
});

test('new uploads and published music stay in their own intensity segment',async()=>{
  const h=harness();
  h.run("custom=[{family:'joy',level:0,title:'Ecstasy'},{family:'joy',level:2,title:'Serenity'}];curated=[{family:'fear',level:0,title:'Terror',kind:'curated'}]");
  const ecstasy=await h.run("candidates('joy',0)");
  assert.ok(ecstasy.some(p=>p.title==='Ecstasy'));
  assert.ok(ecstasy.every(p=>p.level===0&&p.family==='joy'));
  assert.ok(!ecstasy.some(p=>p.title==='Serenity'));
  const terror=await h.run("candidates('fear',0)");
  assert.equal(terror.length,1);assert.equal(terror[0].title,'Terror');
  const outer=await h.run("candidates('fear',2)");
  assert.equal(outer.length,2);assert.ok(outer.every(p=>p.kind==='demo'&&p.level===2));
});
test('random pool covers all 24 emotions and legacy files remain available',async()=>{
  const h=harness();h.run("custom=[{family:'trust',title:'Legacy'}]");
  const pool=await h.run('candidates()');
  assert.equal(new Set(pool.map(p=>p.family+':'+p.level)).size,24);
  assert.equal(pool.filter(p=>p.title==='Legacy').length,3);
  assert.equal((await h.run("candidates('trust',2)")).filter(p=>p.title==='Legacy').length,1);
});
test('published library rejects paths outside its audio directory',async()=>{
  const h=harness();
  h.run("fetch=async()=>({ok:true,json:async()=>({version:1,passages:[{family:'joy',level:0,title:'Bad',path:'music/audio/../../secret',duration:55}]})})");
  await assert.rejects(h.run('loadCurated()'),/Pasaje publicado no válido/);
});

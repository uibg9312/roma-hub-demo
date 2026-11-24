/* Roma Hub — adaptive study media: YouTube, audio and MIDI (no third-party JS). */
(function(){
'use strict';
var active=null;
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function youtubeId(value){var s=String(value||'');if(/^[A-Za-z0-9_-]{11}$/.test(s))return s;try{var u=new URL(s);var h=u.hostname.toLowerCase();if(h==='youtu.be'||h==='www.youtu.be')return (u.pathname.split('/')[1]||'').match(/^[A-Za-z0-9_-]{11}$/)?.[0]||'';if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(h)){var id=u.searchParams.get('v')||(u.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)||[])[1];return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:''}}catch(e){}return ''}
function readMidi(buffer){
 var d=new DataView(buffer),p=0;
 function u8(){if(p>=d.byteLength)throw Error('MIDI incompleto');return d.getUint8(p++)}
 function u16(){var n=d.getUint16(p);p+=2;return n}
 function u32(){var n=d.getUint32(p);p+=4;return n}
 function name(){return String.fromCharCode(u8(),u8(),u8(),u8())}
 function vlq(){var n=0,b,c=0;do{b=u8();n=(n<<7)|(b&127);if(++c>4)throw Error('Duración MIDI inválida')}while(b&128);return n}
 if(name()!=='MThd')throw Error('El archivo no es MIDI');
 var hlen=u32();if(hlen<6)throw Error('Cabecera MIDI inválida');
 var fmt=u16(),count=u16(),division=u16();p=8+hlen;
 if(fmt>1||!count||division&0x8000)throw Error('Formato o división MIDI no compatible');
 var events=[],tempo=[{tick:0,micro:500000}],maxTick=0;
 for(var t=0;t<count;t++){
  if(name()!=='MTrk')throw Error('Pista MIDI inválida');
  var trackLength=u32(),end=p+trackLength,tick=0,run=0,held={};
  if(end>d.byteLength)throw Error('Pista incompleta');
  while(p<end){
   tick+=vlq();maxTick=Math.max(maxTick,tick);
   var stat=d.getUint8(p);if(stat&128){p++;if(stat<240)run=stat}else{if(!run)throw Error('Estado MIDI inválido');stat=run}
   if(stat===255){var mt=u8(),length=vlq(),start=p;p+=length;if(p>end)throw Error('Metaevento inválido');if(mt===81&&length===3)tempo.push({tick:tick,micro:(d.getUint8(start)<<16)|(d.getUint8(start+1)<<8)|d.getUint8(start+2)});continue}
   if(stat===240||stat===247){p+=vlq();if(p>end)throw Error('Evento SysEx inválido');continue}
   var type=stat&240,channel=stat&15,a=u8(),b=(type===192||type===208)?0:u8();
   if(type===144&&b>0){(held[channel+':'+a]||(held[channel+':'+a]=[])).push({start:tick,pitch:a,velocity:b})}
   else if(type===128||(type===144&&b===0)){var q=held[channel+':'+a];if(q&&q.length){var n=q.shift();events.push({start:n.start,end:tick,pitch:a,velocity:n.velocity})}}
  }
  Object.keys(held).forEach(function(k){held[k].forEach(function(n){events.push({start:n.start,end:maxTick,pitch:n.pitch,velocity:n.velocity})})});
  p=end;
 }
 tempo.sort(function(a,b){return a.tick-b.tick});var timeline=[{tick:0,seconds:0,micro:500000}];
 tempo.forEach(function(t){var last=timeline[timeline.length-1];if(t.tick===last.tick){last.micro=t.micro;return}timeline.push({tick:t.tick,seconds:last.seconds+(t.tick-last.tick)*last.micro/(division*1000000),micro:t.micro})});
 function sec(tick){var prev=timeline[0];for(var i=1;i<timeline.length&&timeline[i].tick<=tick;i++)prev=timeline[i];return prev.seconds+(tick-prev.tick)*prev.micro/(division*1000000)}
 var notes=events.filter(function(n){return n.end>n.start}).map(function(n){return {start:sec(n.start),end:sec(n.end),pitch:n.pitch,velocity:n.velocity}}).sort(function(a,b){return a.start-b.start});
 return {notes:notes,duration:Math.max(sec(maxTick),notes.length?Math.max.apply(null,notes.map(function(n){return n.end})):0)};
}
function fmtTime(v){var t=Math.floor(Math.max(0,Number(v)||0));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')}
function stop(){if(!active)return;active.cancelled=true;if(active.raf)cancelAnimationFrame(active.raf);if(active.sound)active.sound.stop();if(active.audio){active.audio.pause();active.audio.removeAttribute('src');active.audio.load()}if(active.url)URL.revokeObjectURL(active.url);if(active.ctx)active.ctx.close().catch(function(){});active=null}
function synth(state,sequence,root){
 var Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx){root.innerHTML='<p role="status">Este navegador no permite sintetizar MIDI. Puedes descargar el archivo para reproducirlo en otra aplicación.</p>';return}
 var ctx=new Ctx(),notes=sequence.notes,pos=0,playing=false,rate=1,loop=false,base=0,nodes=[],raf=0;
 state.ctx=ctx;
 function kill(){nodes.forEach(function(node){try{node.osc.stop()}catch(e){}try{node.osc.disconnect();node.gain.disconnect()}catch(e){}});nodes=[]}
 function current(){return Math.max(0,Math.min(sequence.duration,playing?pos+(ctx.currentTime-base)*rate:pos))}
 function pause(){if(playing){pos=current();playing=false;kill();if(raf)cancelAnimationFrame(raf);raf=0;render()}}
 function render(){var clock=root.querySelector('[data-midi-clock]'),seek=root.querySelector('[data-midi-seek]'),button=root.querySelector('[data-midi-play]');if(clock)clock.textContent=fmtTime(current())+' / '+fmtTime(sequence.duration);if(seek){seek.max=Math.max(1,sequence.duration);if(!seek.matches(':active'))seek.value=current()}if(button)button.textContent=playing?'Pausar':'Reproducir'}
 function frame(){if(!playing||state.cancelled)return;if(current()>=sequence.duration-.015){pause();pos=0;if(loop){play();return}}render();raf=requestAnimationFrame(frame)}
 async function play(){if(playing||state.cancelled)return;try{await ctx.resume()}catch(e){root.querySelector('[data-midi-error]').textContent='No se pudo iniciar el audio: '+e.message;return}
  if(pos>=sequence.duration)pos=0;base=ctx.currentTime;playing=true;
  var startAt=ctx.currentTime+.04;notes.forEach(function(note){
   if(note.end<=pos||note.start>sequence.duration)return;
   var start=startAt+Math.max(0,note.start-pos)/rate,end=startAt+(note.end-pos)/rate;
   if(end<=start+.002)return;
   var osc=ctx.createOscillator(),gain=ctx.createGain(),peak=Math.min(.14,.035+(note.velocity||75)/127*.08);
   osc.type='triangle';osc.frequency.value=440*Math.pow(2,(note.pitch-69)/12);
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(peak,start+.013);
   gain.gain.setValueAtTime(peak,Math.max(start+.013,end-.04));gain.gain.linearRampToValueAtTime(0,end);
   osc.connect(gain);gain.connect(ctx.destination);osc.start(start);osc.stop(end+.01);nodes.push({osc:osc,gain:gain})
  });frame()
 }
 state.sound={stop:function(){pause();kill()},seek:function(n){pause();pos=Math.min(sequence.duration,Math.max(0,n));render()},setRate:function(n){var resume=playing;pause();rate=n;if(resume)play()},setLoop:function(b){loop=b}};
 root.innerHTML='<div class="study-midi-controls"><button type="button" data-midi-play>Reproducir</button><label>Posición <input data-midi-seek type="range" min="0" max="'+Math.max(1,sequence.duration)+'" value="0" step=".1" aria-label="Posición del MIDI"></label><output data-midi-clock>'+fmtTime(0)+' / '+fmtTime(sequence.duration)+'</output><label>Velocidad <select data-midi-speed aria-label="Velocidad MIDI"><option value=".75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><label><input type="checkbox" data-midi-loop> Repetir</label></div><small>Síntesis local de la partitura MIDI. El sonido puede variar respecto a una voz humana.</small><span data-midi-error role="status"></span>';
 root.querySelector('[data-midi-play]').addEventListener('click',function(){playing?pause():play()});
 root.querySelector('[data-midi-seek]').addEventListener('input',function(e){var wasPlaying=playing;pause();pos=Number(e.target.value);render();if(wasPlaying)play()});
 root.querySelector('[data-midi-speed]').addEventListener('change',function(e){state.sound.setRate(Number(e.target.value))});
 root.querySelector('[data-midi-loop]').addEventListener('change',function(e){loop=e.target.checked});render()
}
function mount(host,items,loader){
 stop();
 if(!host)return;
 var choices=(items||[]).filter(function(a){return ['youtube','audio','midi'].includes(a.kind)}),state={cancelled:false,url:null,ctx:null,audio:null,sound:null,raf:null};
 active=state;
 if(!choices.length){host.innerHTML='<p class="study-missing">No hay grabaciones ni MIDI publicados para esta cuerda.</p>';return}
 host.innerHTML='<div class="study-media-header"><label>Recurso <select id="studyMediaSelect" aria-label="Elegir recurso de estudio">'+choices.map(function(a,i){return '<option value="'+i+'">'+escapeHtml((a.kind==='youtube'?'YouTube':a.kind==='midi'?'MIDI':'Audio')+' · '+a.label)+'</option>'}).join('')+'</select></label><span id="studyMediaKind" class="study-chip"></span></div><div class="study-media-stage" id="studyMediaStage" aria-live="polite"></div><div class="study-media-actions"><button type="button" data-media-save class="btn sm white">Guardar para offline</button></div>';
 var selector=host.querySelector('#studyMediaSelect'),stage=host.querySelector('#studyMediaStage'),tag=host.querySelector('#studyMediaKind'),save=host.querySelector('[data-media-save]');
 async function show(index){
  if(state.cancelled)return;var token=state.token=(state.token||0)+1,item=choices[index];
  if(state.sound){state.sound.stop();state.sound=null}if(state.audio){state.audio.pause();state.audio.removeAttribute('src');state.audio=null}if(state.url){URL.revokeObjectURL(state.url);state.url=null}if(state.ctx){state.ctx.close().catch(function(){});state.ctx=null}
  tag.textContent=item.kind==='youtube'?'Video online':item.kind==='midi'?'MIDI sintetizado':'Grabación';save.hidden=item.kind==='youtube';
  if(item.kind==='youtube'){
    var id=youtubeId(item.url||item.videoId);
    if(!id){stage.textContent='Enlace de YouTube no válido';return}
    if(navigator.onLine===false){stage.textContent='YouTube requiere conexión. La partitura sigue disponible.';return}
    stage.innerHTML='<iframe title="'+escapeHtml(item.label)+'" src="https://www.youtube-nocookie.com/embed/'+id+'?playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><small>El video utiliza los controles de YouTube y necesita Internet.</small>';return
  }
  stage.textContent='Preparando '+(item.kind==='midi'?'MIDI':'audio')+'…';
  try{
   var blob=await loader(item,false);
   if(state.cancelled||state.token!==token)return;
   if(item.kind==='midi'){var parsed=readMidi(await blob.arrayBuffer());if(!parsed.notes.length)throw Error('Este archivo MIDI no contiene notas');synth(state,parsed,stage)}
   else{var url=URL.createObjectURL(blob);state.url=url;stage.innerHTML='<audio controls preload="metadata" aria-label="'+escapeHtml(item.label)+'"></audio><label class="study-media-speed">Velocidad <select aria-label="Velocidad de audio"><option value=".75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><label><input type="checkbox" data-audio-loop> Repetir</label>';var a=stage.querySelector('audio');state.audio=a;a.src=url;var speed=stage.querySelector('select');speed.addEventListener('change',function(){a.playbackRate=Number(speed.value);a.preservesPitch=true});stage.querySelector('[data-audio-loop]').addEventListener('change',function(e){a.loop=e.target.checked})}
  }catch(err){if(!state.cancelled&&state.token===token)stage.textContent='No se pudo cargar el recurso: '+err.message}
 }
 selector.addEventListener('change',function(){show(Number(selector.value))});
 save.addEventListener('click',async function(){var item=choices[Number(selector.value)];if(!item||item.kind==='youtube')return;save.disabled=true;save.textContent='Guardando…';try{await loader(item,true);if(!state.cancelled)save.textContent='Guardado offline ✓'}catch(e){if(!state.cancelled)save.textContent='No se pudo guardar'}finally{save.disabled=false}});
 show(0)
}
window.CoroStudyMedia={mount:mount,stop:stop,parseMidi:readMidi,youtubeId:youtubeId};
})();

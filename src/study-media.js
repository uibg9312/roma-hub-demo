/* Roma Hub Demo — adaptive study media: YouTube, audio and MIDI (no third-party JS). */
(function(){
'use strict';
var active=null,ytPromise=null,BOOST_DB=1.5,BOOST_GAIN=Math.pow(10,BOOST_DB/20);
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function youtubeId(value){var s=String(value||'');if(/^[A-Za-z0-9_-]{11}$/.test(s))return s;try{var u=new URL(s);var h=u.hostname.toLowerCase();if(h==='youtu.be'||h==='www.youtu.be')return ((u.pathname.split('/')[1]||'').match(/^[A-Za-z0-9_-]{11}$/)||[])[0]||'';if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(h)){var id=u.searchParams.get('v')||(u.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)||[])[1];return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:''}}catch(e){}return ''}
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
function audioBuffer(blob){if(blob.arrayBuffer)return blob.arrayBuffer();return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){resolve(r.result)};r.onerror=reject;r.readAsArrayBuffer(blob)})}
function outputChain(ctx){var gain=ctx.createGain(),limiter=ctx.createDynamicsCompressor();gain.gain.value=1;limiter.threshold.value=-1.5;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.003;limiter.release.value=.12;gain.connect(limiter);limiter.connect(ctx.destination);return gain}
function setBoost(button,gain,on){gain.gain.value=on?BOOST_GAIN:1;button.setAttribute('aria-pressed',String(on));button.textContent=on?'+1,5 dB activo':'+1,5 dB'}function boostControl(root,gain){var b=root.querySelector('[data-media-boost]');if(!b)return;b.disabled=!gain;if(!gain){b.onclick=null;b.textContent='Amplificación no disponible';return}b.onclick=function(){setBoost(b,gain,b.getAttribute('aria-pressed')!=='true')};}
function controlsHtml(loop){return '<div class="study-transport" role="group" aria-label="Controles de reproducción"><button type="button" data-media-back aria-label="Retroceder 10 segundos">−10 s</button><button type="button" data-media-play>Reproducir</button><button type="button" data-media-forward aria-label="Adelantar 10 segundos">+10 s</button><label class="study-seek"><span class="study-position-label">Posición</span> <input aria-label="Posición de reproducción" type="range" data-media-seek min="0" max="1" step=".1" value="0"></label><output data-media-clock>0:00 / 0:00</output><label class="study-extra">Velocidad <select data-media-speed><option value=".75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label>'+(loop?'<label class="study-extra"><input type="checkbox" data-audio-loop> Repetir</label><button class="study-extra" type="button" data-media-boost aria-pressed="false">+1,5 dB</button>':'')+'</div>'}
function bindTransport(root,api){var q=function(s){return root.querySelector(s)},seek=q('[data-media-seek]'),play=q('[data-media-play]'),speed=q('[data-media-speed]');function refresh(){var d=Number(api.duration())||0,t=Number(api.time())||0;seek.max=Math.max(1,d);if(!seek.matches(':active'))seek.value=t;q('[data-media-clock]').textContent=fmtTime(t)+' / '+fmtTime(d);play.textContent=api.playing()?'Pausar':'Reproducir'}function jump(n){var d=Number(api.duration())||0;if(d>0)api.seek(Math.max(0,Math.min(d,n)));refresh()}play.onclick=function(){api.playing()?api.pause():api.play();refresh()};q('[data-media-back]').onclick=function(){jump(api.time()-10)};q('[data-media-forward]').onclick=function(){jump(api.time()+10)};seek.onchange=function(){jump(Number(seek.value))};speed.onchange=function(){api.rate(Number(speed.value))};refresh();return refresh}
function loadYoutube(){if(window.YT&&window.YT.Player)return Promise.resolve(window.YT);if(ytPromise)return ytPromise;ytPromise=new Promise(function(resolve,reject){var prior=window.onYouTubeIframeAPIReady,timer=setTimeout(function(){ytPromise=null;reject(Error('YouTube no respondió.'))},12000);window.onYouTubeIframeAPIReady=function(){clearTimeout(timer);if(typeof prior==='function')prior();resolve(window.YT)};var script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=function(){clearTimeout(timer);ytPromise=null;script.remove();reject(Error('No se pudo cargar la API de YouTube'))};document.head.appendChild(script)});return ytPromise}
async function mountYoutube(state,stage,id,item,token){stage.innerHTML=controlsHtml(false)+'<div class="study-youtube-frame"><iframe title="'+escapeHtml(item.label)+'" src="https://www.youtube-nocookie.com/embed/'+id+'?enablejsapi=1&playsinline=1&rel=0&origin='+encodeURIComponent(location.origin)+'" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><small data-yt-status role="status">Conectando controles de YouTube…</small><a class="study-external" href="https://www.youtube.com/watch?v='+id+'" target="_blank" rel="noopener noreferrer">Abrir en YouTube</a>';var controls=stage.querySelector('.study-transport'),status=stage.querySelector('[data-yt-status]');function fail(message){if(state.cancelled||state.token!==token)return;stage.classList.remove('yt-ready');stage.classList.add('yt-failed');status.textContent=message}Array.from(controls.querySelectorAll('button,input,select')).forEach(function(b){b.disabled=true});try{var YT=await loadYoutube();if(state.cancelled||state.token!==token)return;state.youtube=new YT.Player(stage.querySelector('iframe'),{events:{onReady:function(e){if(state.cancelled||state.token!==token)return;var p=e.target;Array.from(controls.querySelectorAll('button,input,select')).forEach(function(b){b.disabled=false});var rates=p.getAvailablePlaybackRates();Array.from(controls.querySelectorAll('option')).forEach(function(o){o.disabled=rates.indexOf(Number(o.value))<0});var refresh=bindTransport(stage,{duration:function(){return p.getDuration()},time:function(){return p.getCurrentTime()},playing:function(){return p.getPlayerState()===1},play:function(){p.playVideo()},pause:function(){p.pauseVideo()},seek:function(t){p.seekTo(t,true)},rate:function(v){p.setPlaybackRate(v)}});state.ytTimer=setInterval(refresh,400);stage.classList.add('yt-ready');status.textContent='Volumen: usa los controles de YouTube o del dispositivo.'},onError:function(){fail('Video no disponible aquí. Abre YouTube.')}}})}catch(e){fail('Usa los controles del video o abre YouTube.')}}
function release(state){if(state.ytTimer)clearInterval(state.ytTimer);state.ytTimer=null;if(state.youtube){try{state.youtube.destroy()}catch(e){}state.youtube=null}if(state.sound){state.sound.stop();state.sound=null}if(state.audio){state.audio.pause();state.audio.removeAttribute('src');state.audio.load();state.audio=null}if(state.url){URL.revokeObjectURL(state.url);state.url=null}if(state.ctx){state.ctx.close().catch(function(){});state.ctx=null}}
function stop(){if(!active)return;active.cancelled=true;release(active);active=null}
function synth(state,sequence,root){
 var Ctx=window.AudioContext||window.webkitAudioContext;
 if(!Ctx){root.innerHTML='<p role="status">Este navegador no permite sintetizar MIDI. Puedes descargar el archivo para reproducirlo en otra aplicación.</p>';return}
 var ctx=new Ctx(),notes=sequence.notes,pos=0,playing=false,rate=1,loop=false,base=0,nodes=[],raf=0;
 state.ctx=ctx;var master=outputChain(ctx);
 function kill(){nodes.forEach(function(node){try{node.osc.stop()}catch(e){}try{node.osc.disconnect();node.gain.disconnect()}catch(e){}});nodes=[]}
 function current(){return Math.max(0,Math.min(sequence.duration,playing?pos+(ctx.currentTime-base)*rate:pos))}
 function pause(){if(playing){pos=current();playing=false;kill();if(raf)cancelAnimationFrame(raf);raf=0;render()}}
 function render(){var clock=root.querySelector('[data-midi-clock]'),seek=root.querySelector('[data-midi-seek]'),button=root.querySelector('[data-midi-play]');if(clock)clock.textContent=fmtTime(current())+' / '+fmtTime(sequence.duration);if(seek){seek.max=Math.max(1,sequence.duration);if(!seek.matches(':active'))seek.value=current()}if(button)button.textContent=playing?'Pausar':'Reproducir'}
 function frame(){if(!playing||state.cancelled)return;if(current()>=sequence.duration-.015){pause();pos=0;if(loop){play();return}}render();raf=requestAnimationFrame(frame)}
 async function play(){if(playing||state.cancelled)return;var request=state.token;try{await ctx.resume();if(state.cancelled||state.token!==request)return}catch(e){root.querySelector('[data-midi-error]').textContent='No se pudo iniciar el audio: '+e.message;return}
  if(pos>=sequence.duration)pos=0;base=ctx.currentTime;playing=true;
  var startAt=ctx.currentTime+.04;notes.forEach(function(note){
   if(note.end<=pos||note.start>sequence.duration)return;
   var start=startAt+Math.max(0,note.start-pos)/rate,end=startAt+(note.end-pos)/rate;
   if(end<=start+.002)return;
   var osc=ctx.createOscillator(),gain=ctx.createGain(),peak=Math.min(.14,.035+(note.velocity||75)/127*.08);
   osc.type='triangle';osc.frequency.value=440*Math.pow(2,(note.pitch-69)/12);
   gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(peak,start+.013);
   gain.gain.setValueAtTime(peak,Math.max(start+.013,end-.04));gain.gain.linearRampToValueAtTime(0,end);
   osc.connect(gain);gain.connect(master);osc.start(start);osc.stop(end+.01);nodes.push({osc:osc,gain:gain})
  });frame()
 }
 state.sound={stop:function(){pause();kill()},seek:function(n){pause();pos=Math.min(sequence.duration,Math.max(0,n));render()},setRate:function(n){var resume=playing;pause();rate=n;if(resume)play()},setLoop:function(b){loop=b}};
 root.innerHTML='<div class="study-midi-controls"><button type="button" data-midi-back>−10 s</button><button type="button" data-midi-play>Reproducir</button><button type="button" data-midi-forward>+10 s</button><label class="study-seek"><span class="study-position-label">Posición</span> <input data-midi-seek type="range" min="0" max="'+Math.max(1,sequence.duration)+'" value="0" step=".1" aria-label="Posición del MIDI"></label><output data-midi-clock>'+fmtTime(0)+' / '+fmtTime(sequence.duration)+'</output><label class="study-extra">Velocidad <select data-midi-speed aria-label="Velocidad MIDI"><option value=".75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><label class="study-extra"><input type="checkbox" data-midi-loop> Repetir</label><button class="study-extra" type="button" data-media-boost aria-pressed="false">+1,5 dB</button></div><small>Síntesis local de la partitura MIDI. El sonido puede variar respecto a una voz humana.</small><span data-midi-error role="status"></span>';
 boostControl(root,master);function skip(delta){var resume=playing,n=current()+delta;state.sound.seek(n);if(resume)play()}root.querySelector('[data-midi-back]').onclick=function(){skip(-10)};root.querySelector('[data-midi-forward]').onclick=function(){skip(10)};root.querySelector('[data-midi-play]').addEventListener('click',function(){playing?pause():play()});
 root.querySelector('[data-midi-seek]').addEventListener('input',function(e){var wasPlaying=playing;pause();pos=Number(e.target.value);render();if(wasPlaying)play()});
 root.querySelector('[data-midi-speed]').addEventListener('change',function(e){state.sound.setRate(Number(e.target.value))});
 root.querySelector('[data-midi-loop]').addEventListener('change',function(e){loop=e.target.checked});render()
}
/* Keep all media controls alive when the compact panel is collapsed. */
function setupStudyOptions(host){var dock=host.parentNode;if(!dock)return null;var toggle=dock.querySelector('.study-options-toggle');if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='study-options-toggle';toggle.setAttribute('aria-controls','featuredPlayerHost');dock.insertBefore(toggle,dock.firstChild)}function setOpen(open){dock.classList.toggle('study-options-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Cerrar':'Más · Pistas';if(!open)dock.scrollTop=0}toggle.onclick=function(){setOpen(!dock.classList.contains('study-options-open'))};setOpen(false);return dock}
function mount(host,items,loader,redraw){
 stop();
 if(!host)return;
 var dock=setupStudyOptions(host);
 var choices=(items||[]).filter(function(a){return ['youtube','audio','midi'].includes(a.kind)}),state={cancelled:false,url:null,ctx:null,audio:null,sound:null,raf:null};
 active=state;
 if(dock)dock.classList.remove('study-media-empty');
 if(!choices.length){if(dock){dock.classList.remove('is-youtube');dock.classList.add('study-media-empty');var reader=dock.closest('.reader');if(reader)reader.classList.remove('study-youtube-active')}host.innerHTML='<p class="study-missing">No hay grabaciones ni MIDI publicados para esta cuerda.</p>';return}
 host.innerHTML='<div class="study-media-header"><label>Recurso <select id="studyMediaSelect" aria-label="Elegir recurso de estudio">'+choices.map(function(a,i){return '<option value="'+i+'">'+escapeHtml((a.kind==='youtube'?'YouTube':a.kind==='midi'?'MIDI':'Audio')+' · '+a.label)+'</option>'}).join('')+'</select></label><span id="studyMediaKind" class="study-chip"></span></div><div class="study-media-stage" id="studyMediaStage" aria-live="polite"></div><div class="study-media-actions"><button type="button" data-media-save class="btn sm white">Guardar para offline</button></div>';
 var selector=host.querySelector('#studyMediaSelect'),stage=host.querySelector('#studyMediaStage'),tag=host.querySelector('#studyMediaKind'),save=host.querySelector('[data-media-save]');
 async function show(index){
  if(state.cancelled)return;var token=state.token=(state.token||0)+1,item=choices[index];
  release(state);stage.classList.remove('yt-ready','yt-failed');save.textContent='Guardar para offline';save.disabled=false;if(dock){dock.classList.toggle('is-youtube',item.kind==='youtube');var reader=dock.closest('.reader');if(reader){var wasVideo=reader.classList.contains('study-youtube-active');reader.classList.toggle('study-youtube-active',item.kind==='youtube');if(wasVideo!==(item.kind==='youtube')&&redraw)Promise.resolve(redraw()).catch(function(){})}}
  tag.textContent=item.kind==='youtube'?'Video online':item.kind==='midi'?'MIDI sintetizado':'Grabación';save.hidden=item.kind==='youtube';
  if(item.kind==='youtube'){
    var id=youtubeId(item.url||item.videoId);
    if(!id){stage.textContent='Enlace de YouTube no válido';return}
    if(navigator.onLine===false){stage.textContent='YouTube requiere conexión. La partitura sigue disponible.';return}
    await mountYoutube(state,stage,id,item,token);return
  }
  stage.textContent='Preparando '+(item.kind==='midi'?'MIDI':'audio')+'…';
  try{
   var blob=await loader(item,false);
   if(state.cancelled||state.token!==token)return;
   if(item.kind==='midi'){var parsed=readMidi(await audioBuffer(blob));if(state.cancelled||state.token!==token)return;if(!parsed.notes.length)throw Error('Este archivo MIDI no contiene notas');synth(state,parsed,stage)}
   else{var url=URL.createObjectURL(blob);state.url=url;stage.innerHTML=controlsHtml(true)+'<audio controls preload="metadata" aria-label="'+escapeHtml(item.label)+'"></audio>';var a=stage.querySelector('audio');state.audio=a;a.src=url;var master=null,Ctx=window.AudioContext||window.webkitAudioContext;function initGain(){if(master||!Ctx)return;try{var ctx=new Ctx(),chain=outputChain(ctx),source=ctx.createMediaElementSource(a);source.connect(chain);master=chain;state.ctx=ctx;ctx.resume().catch(function(){});boostControl(stage,master)}catch(e){master=null;if(ctx)ctx.close().catch(function(){});boostControl(stage,null)}}var boost=stage.querySelector('[data-media-boost]');if(!Ctx)boostControl(stage,null);else boost.onclick=function(){initGain();if(master)setBoost(boost,master,true)};var refresh=bindTransport(stage,{duration:function(){return a.duration},time:function(){return a.currentTime},playing:function(){return !a.paused},play:function(){if(state.ctx)state.ctx.resume().catch(function(){});var promise=a.play();if(promise)promise.catch(function(){});},pause:function(){a.pause()},seek:function(t){a.currentTime=t},rate:function(v){a.playbackRate=v;a.preservesPitch=true}});['timeupdate','loadedmetadata','play','pause','ended'].forEach(function(e){a.addEventListener(e,refresh)});stage.querySelector('[data-audio-loop]').addEventListener('change',function(e){a.loop=e.target.checked});if(window.RomaFragment)RomaFragment.attach(stage,a);}
  }catch(err){if(!state.cancelled&&state.token===token)stage.textContent='No se pudo cargar el recurso: '+err.message}
 }
 selector.addEventListener('change',function(){show(Number(selector.value))});
 save.addEventListener('click',async function(){var item=choices[Number(selector.value)],request=state.token;if(!item||item.kind==='youtube')return;save.disabled=true;save.textContent='Guardando…';try{await loader(item,true);if(!state.cancelled&&state.token===request)save.textContent='Guardado offline ✓'}catch(e){if(!state.cancelled&&state.token===request)save.textContent='No se pudo guardar'}finally{if(state.token===request)save.disabled=false}});
 show(0)
}
window.CoroStudyMedia={mount:mount,stop:stop,parseMidi:readMidi,youtubeId:youtubeId,boostGain:BOOST_GAIN};
})();

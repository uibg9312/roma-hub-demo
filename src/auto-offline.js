/* Roma Hub Demo: automatic PDF library after PWA installation. */
(function(){'use strict';
var CACHE='choir-downloaded-pdf-v1',INSTALL='coro-library-installed-v1',PAUSE='coro-library-paused-v1',jobs=[],known=new Set(),publicUrls=new Set(),failed=new Map(),pending=new Map(),controllers=new Set(),sig='',running=false,dirty=false,timer=null,phase='',listener=function(){},last='',panel=null,persistAsked=false;
var media=window.matchMedia?window.matchMedia('(display-mode: standalone)'):null,network=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
function put(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function installed(){return navigator.standalone===true||!!(media&&media.matches)||get(INSTALL)==='1'}
function paused(){return get(PAUSE)==='1'}
function metered(){return !!(network&&(network.saveData||network.type==='cellular'))}
function readerActive(){var root=document.getElementById('readerRoot');return !!(root&&root.children.length)}
function enabled(){return !readerActive()&&installed()&&navigator.onLine!==false&&!paused()&&!!window.caches}
function key(c,u){return c+'\n'+u}
function normalize(raw){try{var u=new URL(raw,location.origin);return u.protocol==='https:'||u.origin===location.origin?u.href:null}catch(e){return null}}
function count(){return jobs.filter(function(j){return known.has(key(j.cache,j.url))}).length}
function abortBulk(){controllers.forEach(function(c){try{c.abort()}catch(e){}})}
function status(){
 var ready=count(),total=jobs.length,done=total>0&&ready===total;
 if(!panel){var main=document.querySelector('.main'),screen=document.getElementById('screen');if(!main||!screen)return;
 panel=document.createElement('section');panel.className='offline-library-status';panel.id='offlineLibraryStatus';panel.hidden=true;
 panel.innerHTML='<div class="offline-library-copy"><strong id="offlineLibraryTitle"></strong><span id="offlineLibraryDetail"></span><progress id="offlineLibraryProgress" max="1" value="0" aria-label="Preparación de partituras"></progress></div><button class="offline-library-pause" type="button" id="offlineLibraryPause">Pausar</button>';
 panel.querySelector('button').addEventListener('click',function(){if(paused()){put(PAUSE,'0');failed.clear();kick(0)}else{put(PAUSE,'1');abortBulk();status()}})}
 var mount=document.getElementById('offlineLibraryMount');if(mount&&panel.parentNode!==mount)mount.appendChild(panel);else if(!mount&&panel.parentNode)panel.parentNode.removeChild(panel);
 panel.hidden=!mount||!installed()||!total;
 var title=done?'Repertorio disponible sin conexión':'Preparando biblioteca sin conexión',detail=ready+' de '+total+' partituras disponibles';
 if(!done){if(!window.caches){title='Almacenamiento no disponible';detail+=' · Este navegador no permite guardar los archivos.'}
 else if(paused()){title='Preparación en pausa';detail+=' · Puedes continuar cuando quieras.'}
 else if(navigator.onLine===false){title='Esperando conexión';detail+=' · Continuará al volver internet.'}
 else if(metered()){title='Descargando partituras con datos móviles';detail+=' · Puedes seguir usando la app o pausar la descarga.'}
 else if(phase==='storage'){title='Espacio insuficiente';detail+=' · Libera espacio y vuelve a abrir la app.'}
 else if(phase==='retry'){title='Preparación parcial';detail+=' · Los pendientes se reintentarán automáticamente.'}
 else {title='Descargando partituras';detail+=' · Puedes seguir usando la app.'}}
 panel.classList.toggle('offline-library-ready',done);panel.querySelector('strong').textContent=title;panel.querySelector('.offline-library-copy span').textContent=detail;
 var bar=panel.querySelector('progress');bar.max=total||1;bar.value=ready;bar.hidden=done;
 var b=panel.querySelector('button');b.hidden=done||!window.caches;b.textContent=paused()?'Continuar':'Pausar';
 var fingerprint=sig+'|'+ready+'|'+publicUrls.size;
 if(last!==fingerprint){last=fingerprint;listener(Array.from(publicUrls))}
}
function configure(scores,extras,cb){if(cb)listener=cb;var map=new Map();
 (scores||[]).forEach(function(s){if(s.published===false||!s.pdfUrl||String(s.id).indexOf('study-')===0||String(s.pdfUrl).indexOf('blob:')===0)return;var u=normalize(s.pdfUrl);if(u)map.set(key(CACHE,u),{cache:CACHE,url:u,save:function(){return save(u,true)}})});
 (extras||[]).forEach(function(j){if(j&&j.cache&&j.url&&typeof j.save==='function'&&!map.has(key(j.cache,j.url)))map.set(key(j.cache,j.url),j)});
 var next=Array.from(map.values()),signature=next.map(function(j){return key(j.cache,j.url)}).join('|');jobs=next;
 if(signature!==sig){sig=signature;dirty=true;kick(12000)}else status()
}
async function scan(){if(!window.caches)return;var names=new Set(jobs.map(function(j){return j.cache})),map=new Map();names.add(CACHE);
 for(var name of names){try{var c=await caches.open(name);map.set(name,new Set((await c.keys()).map(function(r){return r.url})))}catch(e){}}
 publicUrls=map.get(CACHE)||new Set();known=new Set();jobs.forEach(function(j){if((map.get(j.cache)||new Set()).has(j.url))known.add(key(j.cache,j.url))})
}
function mark(c,u){known.add(key(c,u));if(c===CACHE)publicUrls.add(u);failed.delete(key(c,u));phase='';status()}
function quota(e){return e&&(e.name==='QuotaExceededError'||/quota|storage full|disk full/i.test(String(e.message||e)))}
async function validResponse(url,signal){var r=await fetch(url,{mode:'cors',signal:signal});if(!r.ok)throw Error('PDF no disponible ('+r.status+')');var clone=r.clone(),buf;
 if(clone.body&&clone.body.getReader){var reader=clone.body.getReader(),first=await reader.read();buf=first.value||new Uint8Array();reader.cancel().catch(function(){})}else buf=new Uint8Array(await clone.arrayBuffer());
 if(String.fromCharCode.apply(null,Array.from(buf.subarray(0,1024))).indexOf('%PDF-')<0)throw Error('Archivo PDF no válido');return r
}
async function save(u,bulk){if(!window.caches)throw Error('Cache no disponible');var c=await caches.open(CACHE);if(await c.match(u)){mark(CACHE,u);return}if(pending.has(u))return pending.get(u);
 var task=(async function(){var ctrl=typeof AbortController==='function'?new AbortController():null,t=null;if(ctrl){if(bulk)controllers.add(ctrl);t=setTimeout(function(){ctrl.abort()},600000)}
 try{var response=await validResponse(u,ctrl?ctrl.signal:undefined);await c.put(u,response);mark(CACHE,u)}finally{if(t)clearTimeout(t);if(ctrl)controllers.delete(ctrl)}})();pending.set(u,task);
 try{await task}finally{if(pending.get(u)===task)pending.delete(u)}
}
async function read(raw){
 var u=normalize(raw);if(!u)throw Error('URL de partitura no válida');
 if(window.caches){try{var c=await caches.open(CACHE),hit=await c.match(u);if(hit)return hit.arrayBuffer()}catch(e){}}
 if(navigator.onLine===false)throw Error('Esta partitura aún no está lista sin conexión. Se preparará al volver internet.');
 // La lectura no espera una segunda escritura y lectura del mismo PDF en Cache Storage.
 var response=await fetch(u,{mode:'cors'});if(!response.ok)throw Error('PDF no disponible ('+response.status+')');
 var bytes=await response.arrayBuffer();
 if(installed()&&window.caches&&bytes.byteLength<=24*1024*1024&&
    bytes.byteLength>=5&&String.fromCharCode.apply(null,new Uint8Array(bytes,0,5))==='%PDF-'){
  Promise.resolve().then(async function(){
   var cache=await caches.open(CACHE);
   if(!await cache.match(u)){
    await cache.put(u,new Response(new Blob([bytes],{type:'application/pdf'})));
   }
   mark(CACHE,u);
  }).catch(function(e){if(quota(e)){phase='storage';status()}else console.warn('Caché PDF de lectura:',e.message)})
 }
 return bytes;
}
async function work(){if(!enabled())return;
 if(!persistAsked){persistAsked=true;try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){})}catch(e){}}
 if(navigator.storage&&navigator.storage.estimate){try{var est=await navigator.storage.estimate();if(est.quota&&est.quota-(est.usage||0)<8*1024*1024){phase='storage';return}}catch(e){}}
 var list=jobs.filter(function(j){var k=key(j.cache,j.url),v=failed.get(k);return !known.has(k)&&(!v||Date.now()>=v.next)});
 // The original 299.pdf alone is about 205 MB. Keep the other 527 scores first.
 list.sort(function(a,b){return Number(/\/299\.pdf(?:\?|$)/.test(a.url))-Number(/\/299\.pdf(?:\?|$)/.test(b.url))});
 if(!list.length){phase=count()===jobs.length?'':'retry';return}
 var pos=0,blocked=false;phase='';status();
 async function worker(){while(pos<list.length&&enabled()&&!blocked){var j=list[pos++],k=key(j.cache,j.url);if(known.has(k)||!jobs.some(function(x){return key(x.cache,x.url)===k}))continue;
 try{await j.save();var c=await caches.open(j.cache);if(await c.match(j.url))mark(j.cache,j.url);else throw Error('No quedó guardado')}
 catch(e){if(quota(e)){blocked=true;phase='storage';break}if(!enabled())break;var old=failed.get(k),attempt=old?old.attempt+1:1;failed.set(k,{attempt:attempt,next:Date.now()+Math.min(600000,10000*Math.pow(2,Math.min(attempt,5)))})}}}
 await Promise.all([worker(),worker(),worker()]);if(blocked)phase='storage';else if(count()===jobs.length)phase='';else if(enabled())phase='retry'
}
async function run(){if(running){dirty=true;return}running=true;dirty=false;
 try{await scan();status();if(enabled()&&jobs.length){if(navigator.locks&&navigator.locks.request)await navigator.locks.request('roma-hub-pdf-library',{ifAvailable:true},async function(lock){if(lock){await scan();await work()}});else await work()}}
 catch(e){phase=quota(e)?'storage':'retry';console.warn('Biblioteca offline:',e.message)}
 finally{running=false;status();if(dirty)kick(100);else if(enabled()&&count()<jobs.length&&phase!=='storage')kick(30000)}
}
function kick(ms){clearTimeout(timer);timer=setTimeout(run,ms==null?100:ms)}
window.addEventListener('appinstalled',function(){put(INSTALL,'1');kick(0)});
if(media&&media.addEventListener)media.addEventListener('change',function(){if(media.matches)kick(0)});else if(media&&media.addListener)media.addListener(function(){if(media.matches)kick(0)});
window.addEventListener('online',function(){failed.clear();kick(0)});window.addEventListener('offline',function(){abortBulk();status()});
if(network&&network.addEventListener)network.addEventListener('change',function(){kick(0)});
document.addEventListener('visibilitychange',function(){if(!document.hidden){failed.clear();kick(0)}});
window.addEventListener('pageshow',function(){kick(0)});window.CoroAuto={configure:configure,installed:installed,read:read,kick:kick,pauseForReader:function(){abortBulk();clearTimeout(timer)},resumeAfterReader:function(){kick(12000)}};
})();
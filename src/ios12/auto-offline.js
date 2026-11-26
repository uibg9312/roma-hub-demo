/* Roma Hub Demo: automatic PDF library after PWA installation. */
(function(){'use strict';
var CACHE='choir-downloaded-pdf-v1',INSTALL='coro-library-installed-v1',PAUSE='coro-library-paused-v1',BULK='coro-ios12-download-all-v1',SKIPS='coro-ios12-pdf-skipped-v2',MAX_BYTES=24*1024*1024,jobs=[],known=new Set(),publicUrls=new Set(),failed=new Map(),pending=new Map(),controllers=new Set(),sig='',running=false,dirty=false,timer=null,phase='',listener=function(){},last='',panel=null,persistAsked=false,skipped=new Map(),lastError='';
var media=window.matchMedia?window.matchMedia('(display-mode: standalone)'):null,network=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
function put(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function installed(){return navigator.standalone===true||!!(media&&media.matches)||get(INSTALL)==='1'}
function paused(){return get(PAUSE)==='1'}
function ios12(){return !!(window.CoroIOS12&&window.CoroIOS12.isIOS12)}
function bulkRequested(){return ios12()&&get(BULK)==='1'}
function pdfJobs(){return jobs} /* Every configured extra job is a published, accessible study PDF. */
function pdfCount(){return pdfJobs().filter(function(j){return known.has(key(j.cache,j.url))}).length}
function loadSkipped(){try{var data=JSON.parse(get(SKIPS)||'{}');Object.keys(data).forEach(function(k){skipped.set(k,data[k])})}catch(e){}}
function saveSkipped(){var all={};skipped.forEach(function(v,k){all[k]=v});put(SKIPS,JSON.stringify(all))}
function skip(j,message){var k=key(j.cache,j.url);skipped.set(k,{name:j.title||j.url,reason:String(message).slice(0,180)});failed.delete(k);lastError=(j.title||j.url)+': '+String(message).slice(0,130);saveSkipped();status()}
function skippedJobs(){return jobs.filter(function(j){return skipped.has(key(j.cache,j.url))})}
function skippedDetails(){return skippedJobs().map(function(j){return skipped.get(key(j.cache,j.url))||{name:j.title||j.url,reason:'Archivo no disponible'}})}
function meaningfulFailure(e){return String(e&&(e.message||e)||'Error desconocido').slice(0,150)}
loadSkipped();
function bulkState(){var list=pdfJobs(),out=skippedJobs();return {total:list.length,ready:pdfCount(),skipped:out.length,skippedDetails:skippedDetails().slice(0,8),active:bulkRequested(),paused:paused(),online:navigator.onLine!==false,installed:installed(),phase:phase,lastError:lastError,failures:list.filter(function(j){return failed.has(key(j.cache,j.url))}).length,available:!!window.caches||!!window.indexedDB}}
function renderBulkSettings(){var box=document.getElementById('ios12BulkSettings');if(!box)return;var s=bulkState(),label=document.getElementById('ios12BulkSummary'),bar=document.getElementById('ios12BulkProgress'),detail=document.getElementById('ios12BulkDetail'),start=document.getElementById('ios12BulkStart'),pause=document.getElementById('ios12BulkPause'),resume=document.getElementById('ios12BulkResume');
 if(label)label.textContent=s.ready+' de '+s.total+' partituras guardadas'+(s.skipped?' · '+s.skipped+' no descargables':'');
 if(bar){bar.max=s.total||1;bar.value=s.ready;bar.hidden=!s.total}
 var msg='Los PDF ya guardados no se descargan de nuevo. Para continuar, conserva esta app abierta y usa Wi-Fi.';
 if(!s.available)msg='Este navegador no admite el almacenamiento necesario para descargar PDFs.';
 else if(!s.installed&&ios12())msg='Para guardar los PDF dentro de la PWA, instálala desde Safari y ábrela usando el icono de la pantalla de inicio.';
 else if(s.total>0&&s.ready===s.total)msg='Todas las partituras de la biblioteca están guardadas. Su disponibilidad futura depende de que iOS conserve el almacenamiento.';
 else if(s.phase==='storage')msg='Safari no permitió almacenar más archivos, aunque el iPad tenga espacio libre. Ya intentamos una biblioteca IndexedDB adicional. Puedes probar Reanudar.';
 else if(s.phase==='partial')msg='Se guardaron todas las partituras que pudo almacenar este dispositivo. Las restantes requieren revisión.';
 else if(s.paused&&s.active)msg='Descarga pausada. Puedes reanudarla sin repetir archivos.';
 else if(!s.online&&s.active)msg='Sin conexión. Se reanudará cuando recuperes internet y abras la app.';
 else if(s.active)msg='Descargando de una en una para reducir el uso de memoria. Mantén la app abierta; los PDF grandes pueden ocupar mucho espacio.';
 if(s.skipped)msg+=' '+s.skipped+' archivo(s) omitido(s). '+s.skippedDetails.map(function(x){return x.name+' ('+x.reason+')'}).join(' · ');
 if(s.lastError&&!s.skipped)msg+=' Última incidencia: '+s.lastError;
 if(detail)detail.textContent=msg;
 if(start)start.hidden=s.active||s.total>0&&s.ready+s.skipped===s.total;
 if(pause)pause.hidden=!s.active||s.paused||s.ready+s.skipped===s.total||s.phase==='storage'||s.phase==='partial';
 if(resume)resume.hidden=!s.active||(!s.paused&&s.phase!=='storage'&&s.phase!=='partial');
}
function startAll(){if(!window.caches&&!window.indexedDB)return {ok:false,message:'Safari no permite almacenar las partituras.'};if(ios12()&&!installed())return {ok:false,message:'Primero instala la PWA: Safari → Compartir → Añadir a pantalla de inicio. Ábrela desde el icono.'};if(!jobs.length)return {ok:false,message:'El catálogo todavía está cargando. Inténtalo de nuevo.'};put(BULK,'1');put(PAUSE,'0');phase='';failed.clear();dirty=true;kick(0);renderBulkSettings();return {ok:true,message:'Descarga iniciada. Mantén la app abierta mientras se preparan los PDF.'}}
function pauseAll(){put(PAUSE,'1');abortBulk();status();return {ok:true,message:'Descarga pausada. Se conservarán las partituras ya guardadas.'}}
function resumeAll(){if(!window.caches&&!window.indexedDB)return {ok:false,message:'El almacenamiento no está disponible.'};put(BULK,'1');put(PAUSE,'0');phase='';failed.clear();kick(0);status();return {ok:true,message:'Se reanudará la descarga desde las partituras pendientes.'}}
function metered(){return !!(network&&(network.saveData||network.type==='cellular'))}
function readerActive(){var root=document.getElementById('readerRoot');return !!(root&&root.children.length)}
function enabled(){return !readerActive()&&(ios12()?bulkRequested():installed())&&navigator.onLine!==false&&!paused()&&(!!window.caches||ios12()&&!!window.indexedDB)}
function key(c,u){return c+'\n'+u}
function normalize(raw){try{var u=new URL(raw,location.origin);return u.protocol==='https:'||u.origin===location.origin?u.href:null}catch(e){return null}}
function count(){return jobs.filter(function(j){return known.has(key(j.cache,j.url))}).length}
function abortBulk(){controllers.forEach(function(c){try{c.abort()}catch(e){}})}
function status(){
 var ready=ios12()?pdfCount():count(),total=ios12()?pdfJobs().length:jobs.length,done=total>0&&ready===total;
 if(!panel){var main=document.querySelector('.main'),screen=document.getElementById('screen');if(!main||!screen)return;
 panel=document.createElement('section');panel.className='offline-library-status';panel.id='offlineLibraryStatus';panel.hidden=true;
 panel.innerHTML='<div class="offline-library-copy"><strong id="offlineLibraryTitle"></strong><span id="offlineLibraryDetail"></span><progress id="offlineLibraryProgress" max="1" value="0" aria-label="Preparación de partituras"></progress></div><button class="offline-library-pause" type="button" id="offlineLibraryPause">Pausar</button>';
 panel.querySelector('button').addEventListener('click',function(){if(paused()){put(PAUSE,'0');failed.clear();kick(0)}else{put(PAUSE,'1');abortBulk();status()}})}
 var mount=document.getElementById('offlineLibraryMount');if(mount&&panel.parentNode!==mount)mount.appendChild(panel);else if(!mount&&panel.parentNode)panel.parentNode.removeChild(panel);
 panel.hidden=!mount||!installed()||!total;
 var legacy=!!(window.CoroIOS12&&window.CoroIOS12.isIOS12);
 var title=done?'Repertorio disponible sin conexión':'Preparando biblioteca sin conexión',detail=ready+' de '+total+' partituras disponibles';
 if(legacy){title=done?'Biblioteca completa':bulkRequested()?(paused()?'Descarga de partituras en pausa':phase==='storage'?'Límite de almacenamiento web':phase==='partial'?'Descarga parcial completada':navigator.onLine===false?'Descarga esperando conexión':'Descargando partituras para iOS 12'):'Biblioteca offline para iOS 12';detail=ready+' de '+total+' partituras guardadas.'+(skippedJobs().length?' '+skippedJobs().length+' pendientes no descargables.':'')+(bulkRequested()?' Puedes ver los detalles en Configuración.':' Descarga la biblioteca desde Configuración.') }
 else if(!done){if(!window.caches){title='Almacenamiento no disponible';detail+=' · Este navegador no permite guardar los archivos.'}
 else if(paused()){title='Preparación en pausa';detail+=' · Puedes continuar cuando quieras.'}
 else if(navigator.onLine===false){title='Esperando conexión';detail+=' · Continuará al volver internet.'}
 else if(metered()){title='Descargando partituras con datos móviles';detail+=' · Puedes seguir usando la app o pausar la descarga.'}
 else if(phase==='storage'){title='Espacio insuficiente';detail+=' · Libera espacio y vuelve a abrir la app.'}
 else if(phase==='retry'){title='Preparación parcial';detail+=' · Los pendientes se reintentarán automáticamente.'}
 else {title='Descargando partituras';detail+=' · Puedes seguir usando la app.'}}
 panel.classList.toggle('offline-library-ready',done);panel.querySelector('strong').textContent=title;panel.querySelector('.offline-library-copy span').textContent=detail;
 var bar=panel.querySelector('progress');bar.max=total||1;bar.value=ready;bar.hidden=done||legacy&&!bulkRequested();
 var b=panel.querySelector('button');b.hidden=done||legacy||!window.caches;b.textContent=paused()?'Continuar':'Pausar';renderBulkSettings();
 var fingerprint=sig+'|'+ready+'|'+publicUrls.size;
 if(last!==fingerprint){last=fingerprint;listener(Array.from(publicUrls))}
}
function configure(scores,extras,cb){if(cb)listener=cb;var map=new Map();
 (scores||[]).forEach(function(s){if(s.published===false||!s.pdfUrl||String(s.id).indexOf('study-')===0||String(s.pdfUrl).indexOf('blob:')===0)return;var u=normalize(s.pdfUrl);if(u)map.set(key(CACHE,u),{cache:CACHE,url:u,title:s.title||s.origin_id||u,save:function(){return save(u,true)}})});
 (extras||[]).forEach(function(j){if(j&&j.cache&&j.url&&typeof j.save==='function'&&!map.has(key(j.cache,j.url)))map.set(key(j.cache,j.url),j)});
 var next=Array.from(map.values()),signature=next.map(function(j){return key(j.cache,j.url)}).join('|');jobs=next;
 if(signature!==sig){sig=signature;dirty=true;kick(12000)}else status()
}
async function scan(){if(!window.caches)return;var names=new Set(jobs.map(function(j){return j.cache})),map=new Map();names.add(CACHE);
 for(var name of names){try{var c=await caches.open(name);map.set(name,new Set((await c.keys()).map(function(r){return r.url})))}catch(e){}}
 if(ios12()&&window.CoroOffline&&CoroOffline.pdfIdbKeys){var ids=await CoroOffline.pdfIdbKeys();ids.forEach(function(u){var n=u.indexOf('/__study_blob/')>=0?'choir-study-public':CACHE;if(!map.has(n))map.set(n,new Set());map.get(n).add(u)})}
 publicUrls=map.get(CACHE)||new Set();known=new Set();jobs.forEach(function(j){if((map.get(j.cache)||new Set()).has(j.url))known.add(key(j.cache,j.url))})
}
function mark(c,u){known.add(key(c,u));if(c===CACHE)publicUrls.add(u);failed.delete(key(c,u));phase='';status()}
function quota(e){return e&&(e.name==='QuotaExceededError'||/quota|storage full|disk full/i.test(String(e.message||e)))}
async function validResponse(url,signal){var r=await fetch(url,{mode:'cors',signal:signal});if(!r.ok)throw Error('PDF no disponible ('+r.status+')');var clone=r.clone(),buf;
 if(clone.body&&clone.body.getReader){var reader=clone.body.getReader(),first=await reader.read();buf=first.value||new Uint8Array();reader.cancel().catch(function(){})}
 else if(ios12()){var type=r.headers&&r.headers.get?r.headers.get('Content-Type')||'':'';
  if(/html|json|text\/plain/i.test(type))throw Error('La URL no devolvió un PDF');
  if(/pdf|octet-stream/i.test(type)||/\.pdf(?:[?#]|$)/i.test(url))return r;
  throw Error('No se puede verificar el formato del archivo');
 }else buf=new Uint8Array(await clone.arrayBuffer());
 if(String.fromCharCode.apply(null,Array.from(buf.subarray(0,1024))).indexOf('%PDF-')<0)throw Error('Archivo PDF no válido');return r
}
async function save(u,bulk){if(!window.caches&&!window.indexedDB)throw Error('Almacenamiento no disponible');
 var c=window.caches?await caches.open(CACHE):null;
 if(c&&await c.match(u)){mark(CACHE,u);return}
 if(ios12()&&window.CoroOffline&&await CoroOffline.pdfBlob(u)){mark(CACHE,u);return}
 if(pending.has(u))return pending.get(u);
 var task=(async function(){var ctrl=typeof AbortController==='function'?new AbortController():null,t=null;if(ctrl){if(bulk)controllers.add(ctrl);t=setTimeout(function(){ctrl.abort()},600000)}
 try{
  if(ios12()&&window.CoroOffline&&CoroOffline.pdfStore){
    // 299.pdf is ~205MB and exceeds practical limits on the 1GB RAM iPad mini 3.
    if(/\/299\.pdf(?:[?#]|$)/.test(u)){var tooBig=Error('PDF original de unos 205 MB: no apto para guardado masivo en iOS 12');tooBig.code='TOO_LARGE';throw tooBig}
    var response=await validResponse(u,ctrl?ctrl.signal:undefined);
    var len=response.headers&&response.headers.get?Number(response.headers.get('Content-Length')||0):0;
    if(len>MAX_BYTES){var hdr=Error('Archivo de más de 24 MB, excede el límite seguro del iPad mini 3');hdr.code='TOO_LARGE';throw hdr}
    var blob=await response.blob();
    if(blob.size>MAX_BYTES){var oversize=Error('Archivo de '+Math.ceil(blob.size/1048576)+' MB, no apto para descarga masiva');oversize.code='TOO_LARGE';throw oversize}
    if(!blob.size||!/^%PDF-/.test(await pdfPrefix(blob))){var bad=Error('El archivo no contiene un PDF válido');bad.code='INVALID';throw bad}
    await CoroOffline.pdfStore(u,blob);mark(CACHE,u);
  }else{
    var legacyResponse=await validResponse(u,ctrl?ctrl.signal:undefined);
    await c.put(u,legacyResponse);mark(CACHE,u);
  }
 }finally{if(t)clearTimeout(t);if(ctrl)controllers.delete(ctrl)}})();pending.set(u,task);
 try{await task}finally{if(pending.get(u)===task)pending.delete(u)}
}
async function pdfPrefix(blob){var first=blob.slice(0,8);return new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){var bytes=new Uint8Array(reader.result),s='';for(var i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);resolve(s)};reader.onerror=function(){reject(reader.error||Error('Error al leer cabecera del PDF'))};reader.readAsArrayBuffer(first)})}
async function read(raw){var u=normalize(raw);if(!u)throw Error('URL de partitura no válida');
 if(window.caches){try{var c=await caches.open(CACHE),hit=await c.match(u);if(hit)return hit.arrayBuffer()}catch(e){}}
 if(window.CoroOffline&&CoroOffline.pdfBlob){try{var stored=await CoroOffline.pdfBlob(u);if(stored)return await CoroOffline.pdfArrayBuffer(stored)}catch(e){console.warn('Lectura de PDF offline:',e.message)}}
 if(navigator.onLine===false)throw Error('Esta partitura aún no está lista sin conexión. Se preparará al volver internet.');
 if(installed()&&window.caches&&window.CoroIOS12&&window.CoroIOS12.isIOS12){
  var legacyResponse=await fetch(u,{mode:'cors'});if(!legacyResponse.ok)throw Error('PDF no disponible ('+legacyResponse.status+')');
  var legacyBytes=await legacyResponse.arrayBuffer();
  if(legacyBytes.byteLength<=18*1024*1024&&legacyBytes.byteLength>=5){
   try{var firstBytes=new Uint8Array(legacyBytes,0,5);if(String.fromCharCode.apply(null,firstBytes)==='%PDF-'){
    var legacyCache=await caches.open(CACHE);await legacyCache.put(u,new Response(legacyBytes,{headers:{'Content-Type':'application/pdf'}}));mark(CACHE,u);
   }}catch(e){if(quota(e)){phase='storage';status()}}
  }
  return legacyBytes;
 }
 if(installed()&&window.caches){try{await save(u,false);var c2=await caches.open(CACHE),r=await c2.match(u);if(r)return r.arrayBuffer()}catch(e){if(quota(e)){phase='storage';status()}}}
 var response=await fetch(u,{mode:'cors'});if(!response.ok)throw Error('PDF no disponible ('+response.status+')');return response.arrayBuffer()
}
async function work(){if(!enabled())return;
 if(!persistAsked){persistAsked=true;try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){})}catch(e){}}
 if(!ios12()&&navigator.storage&&navigator.storage.estimate){try{var est=await navigator.storage.estimate();if(est.quota&&est.quota-(est.usage||0)<8*1024*1024){phase='storage';return}}catch(e){}}
 var list=(ios12()?pdfJobs():jobs).filter(function(j){var k=key(j.cache,j.url),v=failed.get(k);return !known.has(k)&&!skipped.has(k)&&(!v||Date.now()>=v.next)});
 // The original 299.pdf alone is about 205 MB. Keep the other 527 scores first.
 list.sort(function(a,b){return Number(/\/299\.pdf(?:\?|$)/.test(a.url))-Number(/\/299\.pdf(?:\?|$)/.test(b.url))});
 if(!list.length){phase=count()===jobs.length?'':skippedJobs().length?'partial':'retry';return}
 var pos=0,blocked=false,quotaFailures=0;phase='';status();
 async function worker(){while(pos<list.length&&enabled()&&!blocked){var j=list[pos++],k=key(j.cache,j.url);if(known.has(k)||!jobs.some(function(x){return key(x.cache,x.url)===k}))continue;
 try{await j.save();var c=window.caches?await caches.open(j.cache):null,hit=c?await c.match(j.url):null;if(!hit&&ios12()&&CoroOffline.pdfBlob)hit=await CoroOffline.pdfBlob(j.url);if(hit)mark(j.cache,j.url);else throw Error('No quedó guardado')}
 catch(e){lastError=(j.title||j.url)+': '+meaningfulFailure(e);if(e.code==='TOO_LARGE'||e.code==='INVALID'){skip(j,meaningfulFailure(e));continue}if(quota(e)){if(ios12()&&j.cache!==CACHE){skip(j,'No cabe en la caché limitada de Safari; el archivo privado requiere conexión');continue}quotaFailures++;if(quotaFailures>=2){blocked=true;phase='storage';break}failed.set(k,{attempt:1,next:Date.now()+30000});continue}if(!enabled())break;var old=failed.get(k),attempt=old?old.attempt+1:1;if(attempt>=3){skip(j,meaningfulFailure(e));continue}failed.set(k,{attempt:attempt,next:Date.now()+Math.min(600000,10000*Math.pow(2,Math.min(attempt,5)))})}}}
 if(ios12())await worker();else await Promise.all([worker(),worker(),worker()]);if(blocked)phase='storage';else if((ios12()?pdfCount()===pdfJobs().length:count()===jobs.length))phase='';else if(skippedJobs().length&&pdfCount()+skippedJobs().length>=jobs.length)phase='partial';else if(enabled())phase='retry'
}
async function run(){if(running){dirty=true;return}running=true;dirty=false;
 try{await scan();status();if(enabled()&&jobs.length){if(navigator.locks&&navigator.locks.request)await navigator.locks.request('roma-hub-pdf-library',{ifAvailable:true},async function(lock){if(lock){await scan();await work()}});else await work();if(ios12()){var recorded=pdfCount();await scan();if(pdfCount()<recorded)phase='storage'}}}
 catch(e){phase=quota(e)?'storage':'retry';console.warn('Biblioteca offline:',e.message)}
 finally{running=false;status();if(dirty&&enabled()&&phase!=='storage'&&phase!=='partial')kick(100);else if(enabled()&&(ios12()?pdfCount()+skippedJobs().length<jobs.length:count()<jobs.length)&&phase!=='storage'&&phase!=='partial')kick(30000)}
}
function kick(ms){clearTimeout(timer);timer=setTimeout(run,ms==null?100:ms)}
window.addEventListener('appinstalled',function(){put(INSTALL,'1');kick(0)});
if(media&&media.addEventListener)media.addEventListener('change',function(){if(media.matches)kick(0)});else if(media&&media.addListener)media.addListener(function(){if(media.matches)kick(0)});
window.addEventListener('online',function(){failed.clear();kick(0)});window.addEventListener('offline',function(){abortBulk();status()});
if(network&&network.addEventListener)network.addEventListener('change',function(){kick(0)});
document.addEventListener('visibilitychange',function(){if(!document.hidden){failed.clear();kick(0)}});
window.addEventListener('pageshow',function(){kick(0)});document.addEventListener('click',function(e){var button=e.target&&e.target.closest&&e.target.closest('[data-ios12-bulk]');if(!button)return;var action=button.getAttribute('data-ios12-bulk'),result=action==='start'?startAll():action==='pause'?pauseAll():action==='resume'?resumeAll():null;if(result){renderBulkSettings();var toast=document.getElementById('toast');if(toast){toast.textContent=result.message;toast.classList.add('show');setTimeout(function(){toast.classList.remove('show')},5000)}}});window.CoroAuto={configure:configure,installed:installed,read:read,kick:kick,pauseForReader:function(){abortBulk();clearTimeout(timer)},resumeAfterReader:function(){kick(12000)},bulkState:bulkState,startAll:startAll,pauseAll:pauseAll,resumeAll:resumeAll,renderBulkSettings:renderBulkSettings};
})();
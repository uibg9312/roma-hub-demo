(function(){'use strict';
var promise;
function db(){if(promise)return promise;promise=new Promise(function(resolve,reject){if(!('indexedDB'in window)){reject(Error('Sin IndexedDB'));return}var r=indexedDB.open('coro-italiano-offline-v2',2);r.onupgradeneeded=function(){var d=r.result;['snapshots','recents','favorites','notes','pending'].forEach(function(n){if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'key'})})};r.onsuccess=function(){resolve(r.result)};r.onerror=function(){reject(r.error)}});return promise}
async function item(store,action,val){var d=await db();return new Promise(function(resolve,reject){var t=d.transaction(store,action==='get'||action==='all'?'readonly':'readwrite'),o=t.objectStore(store),r=action==='get'?o.get(val):action==='all'?o.getAll():action==='delete'?o.delete(val):o.put(val);r.onsuccess=function(){resolve(r.result)};r.onerror=function(){reject(r.error)}})}
async function list(store){return await item(store,'all')}
async function readPdf(url){if(!('caches'in window))return null;var c=await caches.open('choir-downloaded-pdf-v1');return await c.match(url)}
async function storePdf(url,response){if(!('caches'in window))throw Error('Cache Storage no está disponible');var c=await caches.open('choir-downloaded-pdf-v1');await c.put(url,response)}
async function pdfKeys(){if(!('caches'in window))return [];var c=await caches.open('choir-downloaded-pdf-v1');return(await c.keys()).map(function(r){return r.url})}

/* iOS 12 PDF fallback: an independent IndexedDB store; does not migrate or delete the existing PDF cache. */
var pdfDbPromise=null;
function pdfDb(){if(pdfDbPromise)return pdfDbPromise;pdfDbPromise=new Promise(function(resolve,reject){
 if(!('indexedDB' in window)){reject(Error('IndexedDB no disponible'));return}
 var request=indexedDB.open('coro-italiano-ios12-pdf-library-v1',1);
 request.onupgradeneeded=function(){if(!request.result.objectStoreNames.contains('pdfs'))request.result.createObjectStore('pdfs',{keyPath:'url'})};
 request.onsuccess=function(){var database=request.result;database.onversionchange=function(){database.close();pdfDbPromise=null};resolve(database)};
 request.onerror=function(){pdfDbPromise=null;reject(request.error||Error('No se pudo abrir la biblioteca local'))};
 request.onblocked=function(){pdfDbPromise=null;reject(Error('La base de datos está ocupada'))};
 });return pdfDbPromise}
function pdfTxn(mode,perform){return pdfDb().then(function(database){return new Promise(function(resolve,reject){
 var tx=database.transaction('pdfs',mode),store=tx.objectStore('pdfs'),request=perform(store),value;
 request.onsuccess=function(){value=request.result};request.onerror=function(){reject(request.error||Error('Error al guardar partitura'))};
 tx.oncomplete=function(){resolve(value)};
 tx.onabort=function(){reject(tx.error||request.error||Error('Guardado de partitura cancelado'))};
 tx.onerror=function(){reject(tx.error||Error('Error en almacenamiento'))};
 })})}
function pdfStore(url,blob){if(!blob||!blob.size) return Promise.reject(Error('PDF vacío'));
 return pdfTxn('readwrite',function(store){return store.put({url:url,blob:blob,size:blob.size,updated:Date.now()})})}
function pdfBlob(url){return pdfTxn('readonly',function(store){return store.get(url)}).then(function(row){return row&&row.blob||null})}
function pdfIdbKeys(){return pdfDb().then(function(database){return new Promise(function(resolve,reject){
 var result=[],tx=database.transaction('pdfs','readonly'),r=tx.objectStore('pdfs').openKeyCursor();
 r.onsuccess=function(){var cursor=r.result;if(cursor){result.push(cursor.key);cursor.continue()}};
 tx.oncomplete=function(){resolve(result)};tx.onerror=function(){reject(tx.error||Error('No se puede consultar biblioteca'))};
 tx.onabort=function(){reject(tx.error||Error('Biblioteca desconectada'))};
 })})}
function pdfArrayBuffer(blob){if(blob&&blob.arrayBuffer)return blob.arrayBuffer();
 return new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result)};reader.onerror=function(){reject(reader.error||Error('No se pudo leer la partitura'))};reader.readAsArrayBuffer(blob)})}
function pdfStoredKeys(){return pdfIdbKeys().catch(function(){return []})}
async function allPdfKeys(){var keys=[];if('caches' in window){try{keys=await pdfKeys()}catch(e){}}
 var more=await pdfStoredKeys();return Array.from(new Set(keys.concat(more)))}
window.CoroOffline={db:db,get:function(store,key){return item(store,'get',key)},put:function(store,value){return item(store,'put',value)},remove:function(store,key){return item(store,'delete',key)},list:list,readPdf:readPdf,storePdf:storePdf,pdfKeys:allPdfKeys,
 pdfStore:pdfStore,pdfBlob:pdfBlob,pdfIdbKeys:pdfStoredKeys,pdfArrayBuffer:pdfArrayBuffer};

})();
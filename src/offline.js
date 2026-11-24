(function(){'use strict';
var promise;
function db(){if(promise)return promise;promise=new Promise(function(resolve,reject){if(!('indexedDB'in window)){reject(Error('Sin IndexedDB'));return}var r=indexedDB.open('coro-italiano-offline-v2',2);r.onupgradeneeded=function(){var d=r.result;['snapshots','recents','favorites','notes','pending'].forEach(function(n){if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'key'})})};r.onsuccess=function(){resolve(r.result)};r.onerror=function(){reject(r.error)}});return promise}
async function item(store,action,val){var d=await db();return new Promise(function(resolve,reject){var t=d.transaction(store,action==='get'||action==='all'?'readonly':'readwrite'),o=t.objectStore(store),r=action==='get'?o.get(val):action==='all'?o.getAll():action==='delete'?o.delete(val):o.put(val);r.onsuccess=function(){resolve(r.result)};r.onerror=function(){reject(r.error)}})}
async function list(store){return await item(store,'all')}
async function readPdf(url){if(!('caches'in window))return null;var c=await caches.open('choir-downloaded-pdf-v1');return await c.match(url)}
async function storePdf(url,response){if(!('caches'in window))throw Error('Cache Storage no está disponible');var c=await caches.open('choir-downloaded-pdf-v1');await c.put(url,response)}
async function pdfKeys(){if(!('caches'in window))return [];var c=await caches.open('choir-downloaded-pdf-v1');return(await c.keys()).map(function(r){return r.url})}
window.CoroOffline={db:db,get:function(store,key){return item(store,'get',key)},put:function(store,value){return item(store,'put',value)},remove:function(store,key){return item(store,'delete',key)},list:list,readPdf:readPdf,storePdf:storePdf,pdfKeys:pdfKeys};
})();
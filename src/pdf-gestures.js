/* Roma Hub: fluid touch navigation for the PDF reader. No modifications to the PDF. */
(function(global){
'use strict';
var current=null;
function clampScale(value){return Math.max(.25,Math.min(4,value))}
function zoomScroll(scroll,fromFocus,toFocus,ratio){
 return {
  left:Math.max(0,(scroll.left+fromFocus.x)*ratio-toFocus.x),
  top:Math.max(0,(scroll.top+fromFocus.y)*ratio-toFocus.y)
 };
}
function attach(options){
 if(current)current.destroy();
 var viewer=options.viewer,paper=options.paper,pan=null,pinch=null,raf=0,wheelTimer=0,wheel=null;
 var requestFrame=global.requestAnimationFrame?global.requestAnimationFrame.bind(global):function(fn){return setTimeout(function(){fn(Date.now())},16)};
 var cancelFrame=global.cancelAnimationFrame?global.cancelAnimationFrame.bind(global):clearTimeout;
 function enabled(){return options.canNavigate()&&!options.isInteractive()}
 function eligible(target){return !target.closest('button,a,input,textarea,select,.touch-midi-hit,.touch-midi-chooser,.readermenu')}
 function point(t){var r=viewer.getBoundingClientRect();return {x:t.clientX-r.left,y:t.clientY-r.top}}
 function midpoint(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
 function snapshot(){return {left:viewer.scrollLeft,top:viewer.scrollTop}}
 function stopMomentum(){if(raf){cancelFrame(raf);raf=0}}
 function preview(ratio,origin,finish,scroll){
  paper.style.transformOrigin='0 0';
  paper.style.transform='scale('+ratio+')';
  var pos=zoomScroll(scroll,origin,finish,ratio);
  viewer.scrollLeft=pos.left;viewer.scrollTop=pos.top;
 }
 function beginPinch(touches){
  stopMomentum();pan=null;wheel=null;clearTimeout(wheelTimer);
  var a=point(touches[0]),b=point(touches[1]);
  pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),scale:options.getScale(),
   origin:midpoint(a,b),focus:midpoint(a,b),scroll:snapshot(),next:options.getScale()};
 }
 function start(e){
  if(!enabled()||!eligible(e.target))return;
  stopMomentum();
  if(e.touches.length>=2){beginPinch(e.touches);e.preventDefault();return}
  if(e.touches.length===1&&!pinch){
   var t=e.touches[0];pan={x:t.clientX,y:t.clientY,lastTime:Date.now(),vx:0,vy:0,moved:false};
  }
 }
 function move(e){
  if(!enabled())return;
  if(e.touches.length>=2){
   if(!pinch)beginPinch(e.touches);
   var a=point(e.touches[0]),b=point(e.touches[1]);
   pinch.focus=midpoint(a,b);
   pinch.next=clampScale(pinch.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance);
   preview(pinch.next/pinch.scale,pinch.origin,pinch.focus,pinch.scroll);
   e.preventDefault();return;
  }
  if(pinch||!pan||e.touches.length!==1)return;
  var t=e.touches[0],dx=t.clientX-pan.x,dy=t.clientY-pan.y,now=Date.now(),dt=Math.max(1,now-pan.lastTime);
  pan.x=t.clientX;pan.y=t.clientY;pan.lastTime=now;
  if(Math.abs(dx)+Math.abs(dy)>0)pan.moved=true;
  if(!pan.moved)return;
  viewer.scrollLeft-=dx;viewer.scrollTop-=dy;
  pan.vx=.65*pan.vx+.35*Math.max(-2.5,Math.min(2.5,-dx/dt));
  pan.vy=.65*pan.vy+.35*Math.max(-2.5,Math.min(2.5,-dy/dt));
  e.preventDefault();
 }
 function momentum(vx,vy){
  if(Math.hypot(vx,vy)<.08)return;
  var last=0;
  function tick(time){
   var dt=last?Math.min(32,time-last):16;last=time;
   var prevX=viewer.scrollLeft,prevY=viewer.scrollTop;
   viewer.scrollLeft+=vx*dt;viewer.scrollTop+=vy*dt;
   if(viewer.scrollLeft===prevX)vx=0;
   if(viewer.scrollTop===prevY)vy=0;
   var decay=Math.pow(.91,dt/16);vx*=decay;vy*=decay;
   raf=Math.hypot(vx,vy)>.06?requestFrame(tick):0;
  }
  raf=requestFrame(tick);
 }
 function end(e){
  if(pinch&&e.touches.length<2){
   var p=pinch;pinch=null;pan=null;paper.style.transform='';paper.style.transformOrigin='';
   var target=zoomScroll(p.scroll,p.origin,p.focus,p.next/p.scale);
   if(Math.abs(p.next-p.scale)>.005)options.onZoom(p.next,target);
   else{viewer.scrollLeft=target.left;viewer.scrollTop=target.top}
   e.preventDefault();return;
  }
  if(!pinch&&pan&&e.touches.length===0){
   var panning=pan;pan=null;
   if(panning.moved)momentum(panning.vx,panning.vy);
  }
 }
 function cancel(){
  pan=null;pinch=null;paper.style.transform='';paper.style.transformOrigin='';stopMomentum();
 }
 function onWheel(e){
  if(!e.ctrlKey||!enabled()||!eligible(e.target))return;
  e.preventDefault();stopMomentum();
  if(!wheel){wheel={scale:options.getScale(),scroll:snapshot(),focus:point(e),next:options.getScale()}}
  wheel.next=clampScale(wheel.next*Math.exp(-e.deltaY*.012));wheel.focus=point(e);
  preview(wheel.next/wheel.scale,wheel.focus,wheel.focus,wheel.scroll);
  clearTimeout(wheelTimer);
  wheelTimer=setTimeout(function(){
   var w=wheel;wheel=null;paper.style.transform='';paper.style.transformOrigin='';
   if(!w)return;var target=zoomScroll(w.scroll,w.focus,w.focus,w.next/w.scale);
   if(Math.abs(w.next-w.scale)>.005)options.onZoom(w.next,target);
  },120);
 }
 viewer.classList.add('gesture-enabled');
 viewer.addEventListener('touchstart',start,{passive:false});
 viewer.addEventListener('touchmove',move,{passive:false});
 viewer.addEventListener('touchend',end,{passive:false});
 viewer.addEventListener('touchcancel',cancel,{passive:true});
 viewer.addEventListener('wheel',onWheel,{passive:false});
 var instance={destroy:function(){
  clearTimeout(wheelTimer);cancel();viewer.classList.remove('gesture-enabled');
  viewer.removeEventListener('touchstart',start);
  viewer.removeEventListener('touchmove',move);
  viewer.removeEventListener('touchend',end);
  viewer.removeEventListener('touchcancel',cancel);
  viewer.removeEventListener('wheel',onWheel);
  if(current===instance)current=null;
 }};
 current=instance;return instance;
}
function destroy(){if(current)current.destroy()}
global.CoroPdfGestures={attach:attach,destroy:destroy,clampScale:clampScale,zoomScroll:zoomScroll};
})(typeof window!=='undefined'?window:globalThis);

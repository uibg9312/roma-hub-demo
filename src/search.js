/* Roma Hub — multilingual, accent-insensitive and typo-tolerant score search. */
(function(root){
'use strict';
var separator;
try{separator=new RegExp('[^\\p{L}\\p{N}]+','gu')}
catch(e){separator=/[\s\u0000-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u00bf\u2000-\u206f\u3000-\u303f]+/g}
function normalize(value){
 return String(value==null?'':value)
  .replace(/ß/g,'ss').replace(/ẞ/g,'ss').replace(/æ/gi,'ae').replace(/œ/gi,'oe')
  .replace(/[øØ]/g,'o').replace(/[łŁ]/g,'l').replace(/[đĐ]/g,'d').replace(/[ıİ]/g,'i')
  .normalize('NFKD').replace(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g,'')
  .toLowerCase().replace(separator,' ').replace(/\s+/g,' ').trim();
}
function editDistance(a,b,limit){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 var prevPrev=null,prev=[],curr=[];
 for(var j=0;j<=b.length;j++)prev[j]=j;
 for(var i=1;i<=a.length;i++){
  curr[0]=i;var best=curr[0];
  for(j=1;j<=b.length;j++){
   var n=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   if(prevPrev&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])n=Math.min(n,prevPrev[j-2]+1);
   curr[j]=n;if(n<best)best=n;
  }
  if(best>limit)return limit+1;
  prevPrev=prev;prev=curr;curr=[];
 }
 return prev[b.length];
}
function wordCost(query,word){
 if(query===word)return 0;
 if(query.length>=2&&word.indexOf(query)===0)return .25+.02*(word.length-query.length);
 if(query.length>=4&&word.indexOf(query)>0)return .9+.02*(word.length-query.length);
 if(query.length<4||word.length<4)return Infinity;
 var allowed=query.length>=8?2:1;
 if(Math.abs(query.length-word.length)>allowed)return Infinity;
 var edits=editDistance(query,word,allowed);
 return edits<=allowed?1.2+edits*.8:Infinity;
}
function allWords(queryWords,candidateWords){
 if(!queryWords.length||!candidateWords.length)return Infinity;
 var sum=0,last=-1;
 for(var i=0;i<queryWords.length;i++){
  var best=Infinity,bestIndex=-1;
  for(var j=0;j<candidateWords.length;j++){
   var cost=wordCost(queryWords[i],candidateWords[j]);
   if(j<last)cost+=.2;
   if(cost<best){best=cost;bestIndex=j;if(cost===0&&j>=last)break}
  }
  if(!isFinite(best))return Infinity;
  sum+=best;last=bestIndex;
 }
 return sum;
}
function rank(query,title,extras){
 var q=normalize(query);if(!q)return 0;
 var t=normalize(title),queryWords=q.split(' '),titleWords=t?t.split(' '):[];
 if(q.length===1){if(titleWords.some(function(w){return w.charAt(0)===q}))return 3;return /^[0-9]$/.test(q)&&extras&&normalize(Array.isArray(extras)?extras[0]:extras).indexOf(q)>=0?8:Infinity;}
 if(t===q)return 0;
 if(t.indexOf(q)===0)return 1;
 if(t.indexOf(q)>0)return 2;
 var compactQuery=q.replace(/ /g,''),compactTitle=t.replace(/ /g,'');
 if(compactQuery.length>=5&&compactTitle.indexOf(compactQuery)>=0)return 2.8;
 var tCost=allWords(queryWords,titleWords);
 if(isFinite(tCost))return 4+tCost;
 var fields=Array.isArray(extras)?extras:[extras];
 var metadata=normalize(fields.filter(function(v){return v!=null}).join(' '));
 if(!metadata)return Infinity;
 if(metadata===q)return 9;
 if(metadata.indexOf(q)>=0)return 10;
 var metadataWords=metadata.split(' '),metaCost=allWords(queryWords,metadataWords);
 if(isFinite(metaCost))return 12+metaCost;
 // Also support mixed queries such as "Gloria tenor".
 var combined=allWords(queryWords,titleWords.concat(metadataWords));
 return isFinite(combined)?16+combined:Infinity;
}
function matches(query,title,extras){return isFinite(rank(query,title,extras))}
root.CoroSearch={normalize:normalize,rank:rank,matches:matches};
})(typeof window!=='undefined'?window:globalThis);

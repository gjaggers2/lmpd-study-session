'use strict';
const APP_VERSION='v1';
const $=s=>document.querySelector(s),V=()=>$('#view');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS={get:(k,d)=>{try{const v=localStorage.getItem('lmpd.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>localStorage.setItem('lmpd.'+k,JSON.stringify(v))};
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
const sopCmp=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);return (x[0]-y[0])||((x[1]||0)-(y[1]||0))};

/* ---------- IndexedDB for material ---------- */
const DB={db:null,open(){return new Promise((res,rej)=>{const r=indexedDB.open('lmpd-study',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
 get(k){return new Promise(res=>{const t=this.db.transaction('kv').objectStore('kv').get(k);t.onsuccess=()=>res(t.result);t.onerror=()=>res(undefined)})},
 put(k,v){return new Promise(res=>{const t=this.db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>res(false)})}};
let M=null,QB=[],AUDIO={};
async function loadMaterial(){let m=null;try{await DB.open();m=await DB.get('material')}catch(e){}
 if(!m){m=await (await fetch('data/material.json?v=1')).json();m.custom=false;try{await DB.put('material',m)}catch(e){}}
 M=m;M.sections.sort((a,b)=>sopCmp(a.id,b.id))}
async function saveMaterial(){M.custom=true;M.sections.sort((a,b)=>sopCmp(a.id,b.id));await DB.put('material',M)}
async function resetMaterial(){const m=await (await fetch('data/material.json?v=1',{cache:'reload'})).json();m.custom=false;M=m;await DB.put('material',M)}
const chName=n=>(M.chapters.find(c=>c.num==n)||{}).name||('Chapter '+n);
const secById=id=>M.sections.find(s=>s.id===id);
const chapters=()=>{const set=[...new Set(M.sections.map(s=>s.chapter))].sort((a,b)=>a-b);return set.map(n=>({num:n,name:chName(n),secs:M.sections.filter(s=>s.chapter==n)}))};

/* ---------- Router ---------- */
let cur='library',arg=null;
function go(t,a){cur=t;arg=a??null;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
 ({library:vLibrary,section:vSection,manage:vManage,edit:vEdit,listen:vListen,quiz:vQuiz,notes:vNotes,note:vNote,settings:vSettings}[t]||vLibrary)(arg);window.scrollTo(0,0)}

/* ---------- Library ---------- */
function fmtText(t,q){return t.split('\n').map(p=>{let h=esc(p);if(q){const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');h=h.replace(re,'<mark>$1</mark>')}
 return /^\d+\.\d+(\.\d+)*\s+[A-Z(]/.test(p)&&p.length<140?`<p class="h">${h}</p>`:`<p>${h}</p>`}).join('')}
function vLibrary(){const s=M.source;
 V().innerHTML=`<h1>Library</h1><div class="card"><b>${esc(s.title)}</b><div class="mut">Source PDF updated ${esc(s.pdfModified)} · ${s.pages} pages · newest revision ${esc(s.latestRevision)}</div>
 <div class="mut">${M.custom?'<span class="pill gold">Customized material</span>':'<span class="pill">Bundled original</span>'} ${M.sections.length} SOPs · <a href="${esc(s.url)}" target="_blank" rel="noopener">Official source</a></div></div>
 <input id="q" placeholder="Search all SOP text (e.g. Code 3, JC-3, 72 hours)" oninput="libSearch(this.value)">
 <div id="res"></div><div class="row"><button class="btn sec" onclick="go('manage')">🛠 Manage material</button></div>`;libSearch('')}
function libSearch(q){q=q.trim();const r=$('#res');if(!r)return;
 if(q.length<2){r.innerHTML=chapters().map(c=>`<div class="list"><div class="item" onclick="this.parentNode.querySelector('.secs').classList.toggle('hidden')"><span class="num">Ch ${c.num}</span><b>${esc(c.name)}</b><span class="chev">${c.secs.length} ▾</span></div><div class="secs hidden">${c.secs.map(s=>`<div class="item" onclick="go('section','${s.id}')"><span class="num">${s.id}</span><span>${esc(s.title)}</span><span class="chev">›</span></div>`).join('')}</div></div>`).join('');return}
 const ql=q.toLowerCase(),hits=[];for(const s of M.sections){const i=s.text.toLowerCase().indexOf(ql),ti=(s.id+' '+s.title).toLowerCase().includes(ql);if(i>=0||ti){const c=(s.text.toLowerCase().split(ql).length-1);hits.push({s,i,c:c+(ti?100:0)})}}
 hits.sort((a,b)=>b.c-a.c);r.innerHTML=`<div class="mut">${hits.length} SOPs match</div><div class="list">`+hits.slice(0,80).map(({s,i})=>{const sn=i>=0?esc(s.text.slice(Math.max(0,i-60),i+100)).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'ig'),m=>`<mark>${m}</mark>`):'';return `<div class="item" onclick="go('section',{id:'${s.id}',q:${esc(JSON.stringify(q))}})"><span class="num">${s.id}</span><div><b>${esc(s.title)}</b><div class="mut">…${sn}…</div></div></div>`}).join('')+'</div>'}
function vSection(a){const id=typeof a==='string'?a:a.id,q=typeof a==='object'?a.q:'';const s=secById(id);if(!s)return go('library');
 const i=M.sections.indexOf(s),p=M.sections[i-1],n=M.sections[i+1];const nn=notesFor(id).length;
 V().innerHTML=`<button class="btn sec sm" onclick="go('library')">‹ Library</button>
 <h1>SOP ${s.id} · ${esc(s.title)}</h1><div class="row"><span class="pill">Ch ${s.chapter} ${esc(chName(s.chapter))}</span>${s.effective?`<span class="pill">Effective ${esc(s.effective)}</span>`:''}${s.revised?`<span class="pill gold">Revised ${esc(s.revised)}</span>`:''}${s.pageStart?`<span class="pill">PDF p.${s.pageStart}${s.pageEnd&&s.pageEnd!=s.pageStart?'–'+s.pageEnd:''}</span>`:''}</div>
 <div class="row"><button class="btn gold sm" onclick="listenTo('${s.id}')">🎧 Listen</button><button class="btn sm" onclick="startQuiz({sops:['${s.id}'],n:10})">✅ Quiz this SOP</button><button class="btn sec sm" onclick="go('note',{sec:'${s.id}'})">📝 Add note${nn?` (${nn})`:''}</button><button class="btn sec sm" onclick="go('edit','${s.id}')">✏️ Edit</button></div>
 <div class="card sop">${fmtText(s.text,q)}</div>
 <div class="row">${p?`<button class="btn sec grow" onclick="go('section','${p.id}')">‹ ${p.id}</button>`:''}${n?`<button class="btn sec grow" onclick="go('section','${n.id}')">${n.id} ›</button>`:''}</div>`;
 if(q){const m=document.querySelector('.sop mark');m&&m.scrollIntoView({block:'center'})}}

/* ---------- Manage material ---------- */
function vManage(){V().innerHTML=`<button class="btn sec sm" onclick="go('library')">‹ Library</button><h1>Manage material</h1>
 <div class="card"><b>Add or update material</b><div class="mut">Upload a text-based PDF or .txt, or paste text. If the SOP number already exists, its text is replaced (update); otherwise a new section is added.</div>
 <label>SOP number</label><input id="nid" placeholder="e.g. 9.7"><label>Title</label><input id="ntitle" placeholder="Title">
 <label>Chapter number</label><input id="nch" inputmode="numeric" placeholder="auto from SOP number"><label>Revised date (optional)</label><input id="nrev" placeholder="MM/DD/YY">
 <label>File (PDF or .txt)</label><input type="file" id="nfile" accept=".pdf,.txt,application/pdf,text/plain" onchange="readFile(this.files[0])">
 <label>Text</label><textarea id="ntext" placeholder="Paste text here"></textarea>
 <label class="chk"><input type="checkbox" id="nsplit"> Split pasted/uploaded text into multiple SOPs automatically (on "SOP Number: x.y" headers)</label>
 <button class="btn gold" onclick="addMaterial()">Save material</button><div id="nmsg" class="mut"></div></div>
 <div class="card"><b>Delete chapters / sections</b><div class="mut">Tap 🗑 to delete. Reset below restores the bundled original.</div>
 ${chapters().map(c=>`<div class="list"><div class="item"><span class="num">Ch ${c.num}</span><b class="grow">${esc(c.name)}</b><button class="btn danger sm" onclick="delChapter('${c.num}')">🗑 Chapter</button></div>${c.secs.map(s=>`<div class="item"><span class="num">${s.id}</span><span class="grow" onclick="go('edit','${s.id}')">${esc(s.title)}</span><button class="btn sec sm" onclick="go('edit','${s.id}')">✏️</button><button class="btn danger sm" data-del="${s.id}" onclick="delSection('${s.id}')">🗑</button></div>`).join('')}</div>`).join('')}</div>
 <div class="card"><b>Reset</b><div class="mut">Restore the bundled official text (removes your edits/deletions/additions).</div><button class="btn danger" onclick="doReset()">Reset to bundled original</button></div>`}
async function delSection(id){if(!confirm('Delete SOP '+id+'?'))return;M.sections=M.sections.filter(s=>s.id!==id);await saveMaterial();toast('Deleted '+id);vManage()}
async function delChapter(n){if(!confirm('Delete entire chapter '+n+'?'))return;M.sections=M.sections.filter(s=>s.chapter!=n);await saveMaterial();toast('Chapter deleted');vManage()}
async function doReset(){if(!confirm('Reset all material to the bundled original?'))return;await resetMaterial();toast('Material reset');go('library')}
let pdfjsP=null;function loadPdfJs(){return pdfjsP||(pdfjsP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res(pdfjsLib)};s.onerror=()=>{pdfjsP=null;rej(new Error('Could not load PDF reader (are you offline?)'))};document.head.appendChild(s)}))}
async function pdfText(file){const lib=await loadPdfJs();const pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise;let out=[];
 for(let p=1;p<=pdf.numPages;p++){const c=await (await pdf.getPage(p)).getTextContent();let lines=[],last=null,line='';for(const it of c.items){const y=Math.round(it.transform[5]);if(last!==null&&Math.abs(y-last)>3){lines.push(line);line=''}line+=(line&&!line.endsWith(' ')?' ':'')+it.str;last=y}lines.push(line);out.push(lines.join('\n'));const m=$('#nmsg');m&&(m.textContent=`Reading PDF page ${p}/${pdf.numPages}…`)}
 return out.join('\n\f\n')}
async function readFile(f){if(!f)return;const m=$('#nmsg');try{let t;if(/pdf$/i.test(f.name)||f.type==='application/pdf'){t=await pdfText(f)}else t=await f.text();
 if(!t.trim()){m.textContent='No text found (scanned PDF?). Paste text instead.';return}$('#ntext').value=t.replace(/\f/g,'');m.textContent=`Loaded ${t.length.toLocaleString()} characters from ${f.name}.`;
 const h=t.match(/SOP Number:\s*([\d.]+)/g);if(h&&new Set(h).size>1)$('#nsplit').checked=true;else if(h&&!$('#nid').value){$('#nid').value=h[0].split(':')[1].trim()}
 const sj=t.match(/Subject:\s*([^\n]+)/);if(sj&&!$('#ntitle').value)$('#ntitle').value=sj[1].trim()}catch(e){m.textContent='Error: '+e.message}}
function cleanPlain(t){return t.replace(/\r/g,'').split(/\n{2,}/).map(p=>p.replace(/\s*\n\s*/g,' ').trim()).filter(Boolean).join('\n')}
async function addMaterial(){const m=$('#nmsg');let t=$('#ntext').value;if(!t.trim()){m.textContent='Add text or a file first.';return}
 let items=[];if($('#nsplit').checked){const parts=t.split(/(?=SOP Number:\s*[\d.]+)/);const map={};
  for(const p of parts){const mm=p.match(/SOP Number:\s*([\d.]+)/);if(!mm)continue;const id=mm[1].replace(/\.$/,'');const sj=(p.match(/Subject:\s*([^\n]+)/)||[])[1];const rv=(p.match(/Revised Date:\s*([\d/]+)/)||[])[1];
   const body=p.replace(/^[\s\S]*?Subject:[^\n]*\n/,'');(map[id]=map[id]||{id,title:sj?sj.trim():'SOP '+id,revised:rv||'',text:''}).text+='\n'+body}
  items=Object.values(map)}
 else{const id=$('#nid').value.trim();if(!/^\d+(\.\d+)?$/.test(id)){m.textContent='Enter a SOP number like 9.7';return}items=[{id,title:$('#ntitle').value.trim()||('SOP '+id),revised:$('#nrev').value.trim(),text:t,ch:$('#nch').value.trim()}]}
 let added=0,upd=0;for(const it of items){const ex=secById(it.id);const text=cleanPlain(it.text);const ch=it.ch||it.id.split('.')[0];
  if(ex){ex.text=text;if(it.title&&!/^SOP /.test(it.title))ex.title=it.title;if(it.revised)ex.revised=it.revised;ex.updatedLocal=new Date().toISOString().slice(0,10);upd++}
  else{M.sections.push({id:it.id,chapter:ch,title:it.title,revised:it.revised,effective:'',text,updatedLocal:new Date().toISOString().slice(0,10)});if(!M.chapters.find(c=>c.num==ch))M.chapters.push({num:ch,name:'Chapter '+ch});added++}}
 await saveMaterial();toast(`Saved: ${added} added, ${upd} updated`);vManage()}
function vEdit(id){const s=secById(id);if(!s)return go('manage');V().innerHTML=`<button class="btn sec sm" onclick="go('section','${id}')">‹ Back</button><h1>Edit SOP ${s.id}</h1>
 <label>Title</label><input id="et" value="${esc(s.title)}"><label>Revised date</label><input id="er" value="${esc(s.revised||'')}"><label>Text</label><textarea id="ex" style="min-height:50vh">${esc(s.text)}</textarea>
 <button class="btn gold" onclick="saveEdit('${id}')">Save</button><button class="btn danger" onclick="delSection('${id}').then(()=>go('library'))">Delete section</button>`}
async function saveEdit(id){const s=secById(id);s.title=$('#et').value;s.revised=$('#er').value;s.text=$('#ex').value;s.updatedLocal=new Date().toISOString().slice(0,10);await saveMaterial();toast('Saved');go('section',id)}

/* ---------- Listen ---------- */
const P={mode:'tts',sec:null,sents:[],i:0,playing:false,rate:LS.get('rate',1),voice:LS.get('voice',''),cont:LS.get('cont',true),scope:null};
function ttsClean(t){return t.replace(/\((KACP|CC)[^)]*\)/g,'').replace(/\s*\(CONTINUED\)/g,'').replace(/[•]/g,'').replace(/^\s*(\d+\)|[a-z]\)|o)\s+/gm,'')}
function splitSents(s){const t=`SOP ${s.id}. ${s.title}.\n`+ttsClean(s.text);return t.split('\n').flatMap(p=>p.split(/(?<=[.!?;:])\s+(?=[A-Z0-9("“])/)).map(x=>x.trim()).filter(x=>x.length>1).flatMap(x=>{if(x.length<=260)return[x];const o=[];let r=x;while(r.length>260){let k=r.lastIndexOf(',',240);if(k<80)k=r.lastIndexOf(' ',240);o.push(r.slice(0,k+1).trim());r=r.slice(k+1)}o.push(r.trim());return o})}
function hasAudio(id){return !!AUDIO[id]}
function listenTo(id){P.sec=id;P.i=0;P.mode=hasAudio(id)?'mp3':'tts';LS.set('pos',{sec:id,i:0,t:0});go('listen');}
function voices(){return speechSynthesis?speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang)):[]}
function vListen(){const pos=LS.get('pos',null);if(!P.sec)P.sec=(pos&&secById(pos.sec)?pos.sec:M.sections[0]?.id);if(pos&&pos.sec===P.sec&&!P.playing)P.i=pos.i||0;
 const s=secById(P.sec);if(!s){V().innerHTML='<h1>Listen</h1><div class="card">No material.</div>';return}
 P.sents=splitSents(s);if(P.i>=P.sents.length)P.i=0;const au=hasAudio(s.id);if(!au)P.mode='tts';
 const opts=chapters().map(c=>`<optgroup label="Ch ${c.num} ${esc(c.name)}">${c.secs.map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${x.id} ${esc(x.title)}${hasAudio(x.id)?' 🎙':''}</option>`).join('')}</optgroup>`).join('');
 V().innerHTML=`<h1>Listen</h1><label>Section</label><select id="lsec" onchange="stopAll();P.sec=this.value;P.i=0;P.mode=hasAudio(this.value)?'mp3':'tts';vListen()">${opts}</select>
 <div class="row" style="margin-top:8px"><button class="btn sm ${P.mode==='mp3'?'gold':'sec'}" ${au?'':'disabled'} onclick="stopAll();P.mode='mp3';vListen()">🎙 Podcast MP3${au?'':' (n/a)'}</button><button class="btn sm ${P.mode==='tts'?'gold':'sec'}" onclick="stopAll();P.mode='tts';vListen()">🗣 Device voice (TTS)</button></div>
 <div id="pl"></div>
 <label class="chk"><input type="checkbox" id="cont" ${P.cont?'checked':''} onchange="P.cont=this.checked;LS.set('cont',P.cont)"> Continue to next section automatically</label>
 <div class="mut">🎙 = pre-recorded podcast audio available (plays in background / lock screen on iPhone). Device voice uses your browser's speech engine; on iPhone it may pause when the screen locks or the app is backgrounded — use Podcast MP3 for locked-screen listening.</div>`;
 P.mode==='mp3'?renderMp3(s):renderTts(s)}
function renderTts(s){const vs=voices();$('#pl').innerHTML=`<div class="card"><div class="row"><b class="grow">SOP ${s.id} · ${esc(s.title)}</b><span class="mut" id="prog">${P.i+1}/${P.sents.length}</span></div>
 <div class="ctrls"><button class="btn sec" title="Previous section" aria-label="Previous section" onclick="secSkip(-1)">⏮</button><button class="btn sec" aria-label="Back sentence" onclick="sentSkip(-1)">⏪</button><button class="btn gold" id="pp" aria-label="Play/Pause" onclick="ttsToggle()">${P.playing?'⏸':'▶'}</button><button class="btn sec" aria-label="Forward sentence" onclick="sentSkip(1)">⏩</button><button class="btn sec" aria-label="Next section" onclick="secSkip(1)">⏭</button></div>
 <div class="row"><label class="grow">Speed <span id="rv">${P.rate.toFixed(2)}×</span><input type="range" id="rate" min="0.6" max="2" step="0.05" value="${P.rate}" oninput="P.rate=+this.value;$('#rv').textContent=P.rate.toFixed(2)+'×';LS.set('rate',P.rate)" onchange="if(P.playing){speechSynthesis.cancel();speakCur()}"></label></div>
 <label>Voice</label><select id="voice" onchange="P.voice=this.value;LS.set('voice',P.voice);if(P.playing){speechSynthesis.cancel();speakCur()}"><option value="">Default</option>${vs.map(v=>`<option ${v.name===P.voice?'selected':''}>${esc(v.name)}</option>`).join('')}</select>
 ${'speechSynthesis' in window?'':'<div class="mut">Speech synthesis not supported in this browser.</div>'}</div>
 <div class="reader" id="reader">${P.sents.map((x,i)=>`<span class="sent ${i===P.i?'cur':''}" data-i="${i}" onclick="P.i=${i};if(P.playing){speechSynthesis.cancel();speakCur()}else hl()">${esc(x)} </span>`).join('')}</div>`;hl()}
function hl(){document.querySelectorAll('.sent.cur').forEach(e=>e.classList.remove('cur'));const e=document.querySelector(`.sent[data-i="${P.i}"]`);if(e){e.classList.add('cur');const r=$('#reader');r&&r.scrollTo({top:e.offsetTop-r.offsetTop-60,behavior:'smooth'})}const p=$('#prog');p&&(p.textContent=`${P.i+1}/${P.sents.length}`);LS.set('pos',{sec:P.sec,i:P.i});mini()}
let utt=null,ttsGen=0;
function speakCur(){if(!('speechSynthesis' in window))return;const g=++ttsGen;const u=new SpeechSynthesisUtterance(P.sents[P.i]||'');u.rate=P.rate;const v=voices().find(v=>v.name===P.voice);if(v)u.voice=v;u.lang=v?v.lang:'en-US';
 u.onend=()=>{if(g!==ttsGen||!P.playing)return;if(P.i<P.sents.length-1){P.i++;hl();speakCur()}else nextSection()};u.onerror=e=>{if(g===ttsGen&&e.error!=='interrupted'&&e.error!=='canceled'){P.playing=false;upd()}};utt=u;speechSynthesis.speak(u);hl()}
function upd(){const b=$('#pp');b&&(b.textContent=P.playing?'⏸':'▶');mini()}
function ttsToggle(){if(P.playing){P.playing=false;ttsGen++;speechSynthesis.cancel()}else{P.playing=true;speechSynthesis.cancel();speakCur()}upd();setMS()}
function sentSkip(d){P.i=Math.max(0,Math.min(P.sents.length-1,P.i+d));if(P.playing&&P.mode==='tts'){speechSynthesis.cancel();speakCur()}else hl()}
function secSkip(d){const i=M.sections.findIndex(s=>s.id===P.sec),n=M.sections[i+d];if(!n)return;const was=P.playing;stopAll();P.sec=n.id;P.i=0;P.mode=hasAudio(n.id)&&P.mode==='mp3'?'mp3':(P.mode==='mp3'&&!hasAudio(n.id)?'tts':P.mode);
 if(cur==='listen')vListen();else{P.sents=splitSents(n)}if(was)P.mode==='mp3'?mp3Play():ttsToggle()}
function nextSection(){if(!P.cont){P.playing=false;upd();return}secSkip(1)}
function stopAll(){P.playing=false;ttsGen++;try{speechSynthesis.cancel()}catch(e){}const a=$('#aud');a.pause();upd()}
/* MP3 */
function renderMp3(s){const a=$('#aud');const src='audio/'+AUDIO[s.id];if(!a.src.endsWith(src)){a.src=src;const pos=LS.get('pos',{});a.dataset.sec=s.id;a.onloadedmetadata=()=>{if(pos.sec===s.id&&pos.t)a.currentTime=pos.t;a.playbackRate=P.rate}}
 $('#pl').innerHTML=`<div class="card"><b>SOP ${s.id} · ${esc(s.title)}</b><div class="mut">Podcast audio · ${esc(AUDIO[s.id])}</div>
 <input type="range" id="seek" min="0" max="1000" value="0" oninput="const a=$('#aud');if(a.duration)a.currentTime=a.duration*this.value/1000"><div class="row mut"><span id="tcur">0:00</span><span class="grow"></span><span id="tdur">--:--</span></div>
 <div class="ctrls"><button class="btn sec" aria-label="Previous section" onclick="secSkip(-1)">⏮</button><button class="btn sec" aria-label="Back 15 seconds" onclick="$('#aud').currentTime-=15">−15</button><button class="btn gold" id="pp" aria-label="Play/Pause" onclick="mp3Toggle()">${P.playing?'⏸':'▶'}</button><button class="btn sec" aria-label="Forward 15 seconds" onclick="$('#aud').currentTime+=15">+15</button><button class="btn sec" aria-label="Next section" onclick="secSkip(1)">⏭</button></div>
 <label>Speed <span id="rv">${P.rate.toFixed(2)}×</span><input type="range" min="0.6" max="2" step="0.05" value="${P.rate}" oninput="P.rate=+this.value;$('#aud').playbackRate=P.rate;$('#rv').textContent=P.rate.toFixed(2)+'×';LS.set('rate',P.rate)"></label></div>
 <div class="reader">${fmtText(s.text)}</div>`;a.playbackRate=P.rate}
function mp3Play(){const a=$('#aud');const s=secById(P.sec);if(!s||!hasAudio(s.id))return;const src='audio/'+AUDIO[s.id];if(!a.src.endsWith(src))a.src=src;a.playbackRate=P.rate;a.play().then(()=>{P.playing=true;upd();setMS()}).catch(e=>{toast('Tap play to start audio')})}
function mp3Toggle(){const a=$('#aud');if(a.paused)mp3Play();else{a.pause();P.playing=false;upd()}}
function fmtT(x){x=Math.floor(x||0);return Math.floor(x/60)+':'+String(x%60).padStart(2,'0')}
function initAudio(){const a=$('#aud');let lastSave=0;a.addEventListener('timeupdate',()=>{const sk=$('#seek');if(sk&&a.duration){sk.value=a.currentTime/a.duration*1000;$('#tcur').textContent=fmtT(a.currentTime);$('#tdur').textContent=fmtT(a.duration)}
 if(Date.now()-lastSave>3000){lastSave=Date.now();LS.set('pos',{sec:P.sec,i:0,t:a.currentTime})}});
 a.addEventListener('ended',()=>{LS.set('pos',{sec:P.sec,i:0,t:0});if(P.cont){const i=M.sections.findIndex(s=>s.id===P.sec);const n=M.sections.slice(i+1).find(s=>hasAudio(s.id));if(n){P.sec=n.id;P.mode='mp3';if(cur==='listen')vListen();mp3Play();return}}P.playing=false;upd()});
 a.addEventListener('pause',()=>{if(P.mode==='mp3'){P.playing=false;upd()}});a.addEventListener('play',()=>{P.playing=true;upd()})}
function setMS(){if(!('mediaSession' in navigator))return;const s=secById(P.sec);try{navigator.mediaSession.metadata=new MediaMetadata({title:`SOP ${s.id} ${s.title}`,artist:'LMPD Study Session',album:'Ch '+s.chapter+' '+chName(s.chapter),artwork:[{src:'icons/icon-512.png',sizes:'512x512',type:'image/png'}]});
 const h={play:()=>P.mode==='mp3'?mp3Play():(!P.playing&&ttsToggle()),pause:()=>P.mode==='mp3'?$('#aud').pause():(P.playing&&ttsToggle()),previoustrack:()=>secSkip(-1),nexttrack:()=>secSkip(1),seekbackward:()=>P.mode==='mp3'?$('#aud').currentTime-=15:sentSkip(-1),seekforward:()=>P.mode==='mp3'?$('#aud').currentTime+=15:sentSkip(1)};
 for(const k in h)try{navigator.mediaSession.setActionHandler(k,h[k])}catch(e){}}catch(e){}}
function mini(){const m=$('#mini');if(!P.playing||cur==='listen'){m.classList.add('hidden');return}const s=secById(P.sec);m.classList.remove('hidden');m.innerHTML=`<span>🎧</span><span class="t" onclick="go('listen')">SOP ${s.id} ${esc(s.title)}</span><button onclick="P.mode==='mp3'?mp3Toggle():ttsToggle()">${P.playing?'⏸':'▶'}</button>`}

/* ---------- Quiz ---------- */
const QS={get stats(){return LS.get('qstats',{})},set stats(v){LS.set('qstats',v)},get hist(){return LS.get('qhist',[])},set hist(v){LS.set('qhist',v)}};
let QZ=null;
function vQuiz(){if(QZ&&!QZ.done)return renderQ();const st=QS.stats,h=QS.hist;const tot=Object.values(st).reduce((a,s)=>({c:a.c+s.c,w:a.w+s.w}),{c:0,w:0});const missed=QB.filter(q=>st[q.id]&&st[q.id].w>0&&st[q.id].streak<2).length;
 const chs=[...new Set(QB.map(q=>q.chapter))].sort((a,b)=>a-b);
 V().innerHTML=`<h1>Quiz</h1><div class="card"><div class="row"><div class="grow"><div class="mut">Overall accuracy</div><div class="big">${tot.c+tot.w?Math.round(tot.c/(tot.c+tot.w)*100)+'%':'—'}</div><div class="mut">${tot.c} right · ${tot.w} wrong · ${QB.length} questions in bank</div></div></div></div>
 <div class="card"><b>New quiz</b><label>Number of questions</label><select id="qn">${[5,10,20,25,50,100].map(n=>`<option ${n==LS.get('qn',10)?'selected':''}>${n}</option>`).join('')}</select>
 <label>Chapters</label><label class="chk"><input type="checkbox" id="qall" checked onchange="document.querySelectorAll('.qch').forEach(c=>c.checked=this.checked)"> <b>All chapters</b></label>
 ${chs.map(c=>`<label class="chk"><input type="checkbox" class="qch" value="${c}" checked onchange="$('#qall').checked=[...document.querySelectorAll('.qch')].every(x=>x.checked)"> Ch ${c} · ${esc(chName(c))} <span class="mut">(${QB.filter(q=>q.chapter==c).length})</span></label>`).join('')}
 <button class="btn gold block" onclick="startFromForm(false)">▶ Start random quiz</button><button class="btn block" ${missed?'':'disabled'} onclick="startFromForm(true)">🔁 Review missed questions (${missed})</button></div>
 <h2>Accuracy by chapter</h2><div class="card"><table><tr><th>Chapter</th><th>Answered</th><th>Accuracy</th></tr>${chs.map(c=>{let r=0,w=0;QB.filter(q=>q.chapter==c).forEach(q=>{const s=st[q.id];if(s){r+=s.c;w+=s.w}});const p=r+w?Math.round(r/(r+w)*100):null;return `<tr><td>Ch ${c} ${esc(chName(c))}</td><td>${r+w}</td><td>${p==null?'—':`<div class="bar"><i style="width:${p}%"></i></div>${p}%`}</td></tr>`}).join('')}</table></div>
 <h2>History</h2><div class="card">${h.length?`<table><tr><th>Date</th><th>Type</th><th>Score</th></tr>${h.slice().reverse().slice(0,30).map(x=>`<tr><td>${new Date(x.d).toLocaleString()}</td><td>${x.review?'Review':'Random'} · ${esc(x.scope)}</td><td><b>${x.pct}%</b> (${x.c}✔ ${x.w}✘)</td></tr>`).join('')}</table><button class="btn sec sm" onclick="if(confirm('Clear quiz history and stats?')){QS.hist=[];QS.stats={};vQuiz()}">Clear history</button>`:'<div class="mut">No quizzes yet.</div>'}</div>`}
function startFromForm(review){const n=+$('#qn').value;LS.set('qn',n);const chs=[...document.querySelectorAll('.qch:checked')].map(c=>c.value);if(!chs.length)return toast('Pick at least one chapter');startQuiz({chs,n,review,scope:$('#qall').checked?'All chapters':'Ch '+chs.join(', ')})}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function startQuiz(o){const st=QS.stats;let pool=QB.filter(q=>(!o.chs||o.chs.includes(String(q.chapter)))&&(!o.sops||o.sops.includes(q.sop)));
 if(o.review){pool=pool.filter(q=>st[q.id]&&st[q.id].w>0&&st[q.id].streak<2).sort((a,b)=>{const A=st[a.id],B=st[b.id];return (B.w-B.c*0.5)-(A.w-A.c*0.5)||B.lw-A.lw});pool=shuffle(pool.slice(0,o.n))}
 else{pool=shuffle(pool.slice());pool.sort((a,b)=>((st[b.id]?.w||0)>0&&(st[b.id]?.streak||0)<2)-((st[a.id]?.w||0)>0&&(st[a.id]?.streak||0)<2)||0);const weak=pool.filter(q=>st[q.id]?.w>0&&st[q.id].streak<2).slice(0,Math.floor(o.n/4));const rest=shuffle(pool.filter(q=>!weak.includes(q)));pool=shuffle(weak.concat(rest.slice(0,o.n-weak.length)))}
 if(!pool.length){toast('No questions match');return}
 QZ={qs:pool.slice(0,o.n).map(q=>({q,order:shuffle([0,1,2,3])})),i:0,c:0,w:0,ans:null,review:!!o.review,scope:o.scope||(o.sops?'SOP '+o.sops.join(','):'Custom'),done:false};go('quiz')}
function renderQ(){const it=QZ.qs[QZ.i],q=it.q,a=QZ.ans;const sec=secById(q.sop);
 V().innerHTML=`<div class="row"><b class="grow">Question ${QZ.i+1} of ${QZ.qs.length}</b><span class="pill">✔ ${QZ.c}</span><span class="pill">✘ ${QZ.w}</span><button class="btn sec sm" onclick="if(confirm('Quit this quiz?')){QZ=null;vQuiz()}">Quit</button></div><div class="bar"><i style="width:${QZ.i/QZ.qs.length*100}%"></i></div>
 <div class="card"><div class="mut">Ch ${q.chapter} · SOP ${q.sop}${sec?' '+esc(sec.title):''}</div><h2 style="color:var(--ink)">${esc(q.q)}</h2>
 ${it.order.map(k=>`<button class="opt ${a!=null?(k===q.answer?'ok':(k===a?'bad':'')):''}" ${a!=null?'disabled':''} onclick="answer(${k})">${esc(q.options[k])}</button>`).join('')}</div>
 ${a!=null?`<div class="card fb"><b>${a===q.answer?'✔ Correct':'✘ Incorrect'}</b> — correct answer: <b>${esc(q.options[q.answer])}</b><p>${esc(q.explanation)}</p><div class="mut">Citation: SOP ${esc(q.sec)} ${sec?'· <a href="#" onclick="go(\'section\',\''+q.sop+'\');return false">open SOP</a>':''}</div></div><button class="btn gold block" onclick="nextQ()">${QZ.i<QZ.qs.length-1?'Next question ›':'See results'}</button>`:''}`}
function answer(k){if(QZ.ans!=null)return;const q=QZ.qs[QZ.i].q;QZ.ans=k;const st=QS.stats;const s=st[q.id]||{c:0,w:0,streak:0,lw:0};if(k===q.answer){QZ.c++;s.c++;s.streak++}else{QZ.w++;s.w++;s.streak=0;s.lw=Date.now()}st[q.id]=s;QS.stats=st;renderQ()}
function nextQ(){if(QZ.i<QZ.qs.length-1){QZ.i++;QZ.ans=null;renderQ();window.scrollTo(0,0);return}QZ.done=true;const pct=Math.round(QZ.c/QZ.qs.length*100);const h=QS.hist;h.push({d:Date.now(),c:QZ.c,w:QZ.w,pct,review:QZ.review,scope:QZ.scope});QS.hist=h;
 V().innerHTML=`<h1>Quiz complete</h1><div class="card" style="text-align:center"><div class="big" id="score">${pct}%</div><div>${QZ.c} right · ${QZ.w} wrong of ${QZ.qs.length}</div></div><button class="btn gold block" onclick="QZ=null;vQuiz()">Back to Quiz</button>`}

/* ---------- Notes ---------- */
const notes=()=>LS.get('notes',[]);const saveNotes=n=>LS.set('notes',n);const notesFor=id=>notes().filter(n=>n.sec===id);
function vNotes(){V().innerHTML=`<h1>Notes</h1><div class="row"><button class="btn gold" onclick="go('note',{})">＋ New note</button><button class="btn sec" onclick="exportNotes()">⬇ Export notes</button></div><input id="nq" placeholder="Search notes" oninput="drawNotes(this.value)"><div id="nl"></div>`;drawNotes('')}
function drawNotes(q){q=q.toLowerCase();const n=notes().filter(x=>!q||(x.title+' '+x.body+' '+(x.sec||'')).toLowerCase().includes(q)).sort((a,b)=>b.u-a.u);
 $('#nl').innerHTML=n.length?`<div class="list">${n.map(x=>`<div class="item" onclick="go('note',{id:'${x.id}'})"><div class="grow"><b>${esc(x.title||'(untitled)')}</b>${x.sec?` <span class="pill">SOP ${esc(x.sec)}</span>`:''}<div class="mut">${esc(x.body.slice(0,110))}</div></div><span class="chev">›</span></div>`).join('')}</div>`:'<div class="card mut">No notes yet.</div>'}
function vNote(o){const n=o.id?notes().find(x=>x.id===o.id):{title:'',body:'',sec:o.sec||''};if(!n)return go('notes');
 V().innerHTML=`<button class="btn sec sm" onclick="go('notes')">‹ Notes</button><h1>${o.id?'Edit':'New'} note</h1><label>Title</label><input id="ntt" value="${esc(n.title)}"><label>Linked SOP (optional)</label><select id="nsec"><option value="">— none —</option>${M.sections.map(s=>`<option value="${s.id}" ${s.id===n.sec?'selected':''}>${s.id} ${esc(s.title)}</option>`).join('')}</select>
 <label>Note</label><textarea id="nbd" style="min-height:40vh">${esc(n.body)}</textarea><button class="btn gold" onclick="saveNote('${o.id||''}')">Save</button>${o.id?`<button class="btn danger" onclick="delNote('${o.id}')">Delete</button>`:''}${n.sec?`<button class="btn sec" onclick="go('section','${n.sec}')">Open SOP ${n.sec}</button>`:''}`}
function saveNote(id){const a=notes();const d={title:$('#ntt').value.trim(),body:$('#nbd').value,sec:$('#nsec').value,u:Date.now()};if(id){Object.assign(a.find(x=>x.id===id),d)}else a.push({id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),c:Date.now(),...d});saveNotes(a);toast('Note saved');go('notes')}
function delNote(id){if(!confirm('Delete this note?'))return;saveNotes(notes().filter(x=>x.id!==id));toast('Deleted');go('notes')}
function dl(name,text,type){const b=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
function exportNotes(){const t=notes().map(n=>`## ${n.title||'(untitled)'}${n.sec?` [SOP ${n.sec}]`:''}\n${new Date(n.u).toLocaleString()}\n\n${n.body}\n`).join('\n---\n\n');dl('lmpd-notes.md','# LMPD Study Session Notes\n\n'+t,'text/markdown')}

/* ---------- Settings ---------- */
function vSettings(){const s=M.source;V().innerHTML=`<h1>Settings</h1><h2>App version</h2><div class="card"><b>LMPD Study Session ${APP_VERSION}</b><div class="mut">Updates install automatically when online. If this isn't the latest, close and reopen the app.</div></div>
 <h2>Source</h2><div class="card"><div>${esc(s.title)}</div><div class="mut">PDF last modified ${esc(s.pdfModified)} · ${s.pages} pages · retrieved ${esc(s.retrieved)}<br>Newest revision: ${esc(s.latestRevision)}<br><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></div><div class="mut">Study aid only — always defer to the official current SOP. Questions were written from the SOP text.</div></div>
 <h2>Backup</h2><div class="card"><div class="mut">Includes notes, quiz history/stats, listening position, settings, and any custom material edits.</div><button class="btn" onclick="exportAll()">⬇ Export backup</button><button class="btn sec" onclick="$('#imp').click()">⬆ Import backup</button><input type="file" id="imp" accept="application/json,.json" hidden onchange="importAll(this.files[0])"></div>
 <h2>Material</h2><div class="card"><button class="btn sec" onclick="go('manage')">🛠 Manage material</button><button class="btn danger" onclick="doReset()">Reset material to bundled original</button></div>
 <h2>Danger zone</h2><div class="card"><button class="btn danger" onclick="if(confirm('Erase all notes, quiz history and settings?')){Object.keys(localStorage).filter(k=>k.startsWith('lmpd.')).forEach(k=>localStorage.removeItem(k));toast('Cleared');go('library')}">Erase my data</button></div>`}
async function exportAll(){const d={app:'lmpd-study',v:APP_VERSION,at:new Date().toISOString(),ls:{}};Object.keys(localStorage).filter(k=>k.startsWith('lmpd.')).forEach(k=>d.ls[k]=localStorage.getItem(k));if(M.custom)d.material=M;dl('lmpd-study-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(d),'application/json')}
async function importAll(f){if(!f)return;try{const d=JSON.parse(await f.text());if(d.app!=='lmpd-study')throw new Error('Not an LMPD Study backup');for(const k in d.ls)localStorage.setItem(k,d.ls[k]);if(d.material){M=d.material;await DB.put('material',M)}toast('Backup restored');go('library')}catch(e){alert('Import failed: '+e.message)}}

/* ---------- Boot ---------- */
(async function(){try{await loadMaterial();QB=await (await fetch('data/questions.json?v=1')).json();try{AUDIO=await (await fetch('data/audio.json?v=1')).json()}catch(e){AUDIO={}}}catch(e){V().innerHTML='<div class="card">Failed to load data. Connect once to download the material.</div>';return}
 $('#srcline').textContent='SOP · PDF updated '+M.source.pdfModified;initAudio();if('speechSynthesis' in window)speechSynthesis.onvoiceschanged=()=>{if(cur==='listen'&&P.mode==='tts'&&!P.playing)vListen()};go('library')})();
if('serviceWorker'in navigator){let reloaded=false;const had=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had&&!reloaded&&!P.playing){reloaded=true;location.reload()}});
 addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{if(!reg)return;reg.update();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{})})}).catch(()=>{}))}

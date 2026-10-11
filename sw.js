const V='v2',C='lmpd-study-'+V,A=['./','index.html','styles.css?v=2','app.js?v=2','manifest.webmanifest','data/material.json?v=2','data/questions.json?v=2','data/audio.json?v=2','icons/icon-192.png','icons/icon-512.png','icons/icon-180.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A.map(u=>new Request(u,{cache:'reload'})))))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('lmpd-study-')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
 const u=new URL(r.url);if(u.pathname.includes('/audio/'))return; // stream MP3s directly (range requests)
 const net=r.mode==='navigate'||/\.(html|js|css|webmanifest|json)$/.test(u.pathname)||u.pathname.endsWith('/');
 if(net){e.respondWith(fetch(r,{cache:'no-store'}).then(n=>{const cp=n.clone();caches.open(C).then(c=>c.put(r,cp));return n}).catch(()=>caches.match(r).then(m=>m||caches.match(r,{ignoreSearch:true})).then(m=>m||caches.match('index.html'))));return}
 e.respondWith(caches.match(r).then(m=>m||fetch(r).then(n=>{const cp=n.clone();caches.open(C).then(c=>c.put(r,cp));return n})))});

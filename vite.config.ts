import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
async function files(dir:string):Promise<string[]>{
  const entries=await readdir(dir,{withFileTypes:true});
  const all=await Promise.all(entries.map(e=>e.isDirectory()?files(join(dir,e.name)):Promise.resolve([join(dir,e.name)])));
  return all.flat();
}
export default defineConfig({
  plugins: [react(),{name:'offline-bundle',async closeBundle(){
    const paths=(await files('dist')).filter(p=>!p.endsWith('sw.js')).map(p=>'/'+p.slice(5).replaceAll('\\','/'));
    const version=createHash('sha256').update(paths.join('|')).digest('hex').slice(0,12);
    const source=`const CACHE='veille-${version}';const FILES=${JSON.stringify(paths)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('veille-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith((async()=>{const cache=await caches.open(CACHE);if(e.request.mode==='navigate'){try{return await fetch(e.request);}catch{return await cache.match('/index.html')||new Response('Hors connexion',{status:503});}}return await cache.match(e.request,{ignoreVary:true})||fetch(e.request);})());});`;
    await writeFile('dist/sw.js',source);
  }}], worker: { format: 'es' }, server: { port: 5173, strictPort: true },
});


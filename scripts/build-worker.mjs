import { build } from 'esbuild';
// MediaPipe's WASM loader requires importScripts, available in classic workers.
// Bundle ahead of time so both Vite dev and Android use the same worker runtime.
await build({entryPoints:['src/vision/face.worker.ts'],outfile:'public/vision-worker.js',bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});

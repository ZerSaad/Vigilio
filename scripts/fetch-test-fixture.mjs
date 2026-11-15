import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('tests/fixtures',{recursive:true});
const response=await fetch('https://storage.googleapis.com/mediapipe-assets/portrait.jpg');
if(!response.ok)throw new Error(`Image de test indisponible : ${response.status}`);
await writeFile('tests/fixtures/portrait.jpg',Buffer.from(await response.arrayBuffer()));
console.log('Image de test officielle MediaPipe téléchargée.');

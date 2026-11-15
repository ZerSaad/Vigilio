import { mkdir, copyFile, readdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
await mkdir('public/wasm', { recursive: true });
await mkdir('public/models', { recursive: true });
for (const name of await readdir('node_modules/@mediapipe/tasks-vision/wasm')) {
  if (/\.(wasm|js)$/.test(name)) await copyFile(join('node_modules/@mediapipe/tasks-vision/wasm', name), join('public/wasm', name));
}
for (const model of ['face_landmarker', 'hand_landmarker']) {
  const target = `public/models/${model}.task`;
  try { await access(target); console.log(`Modèle ${model} déjà disponible.`); }
  catch {
    console.log(`Téléchargement du modèle officiel ${model}…`);
    const response = await fetch(`https://storage.googleapis.com/mediapipe-models/${model}/${model}/float16/1/${model}.task`);
    if (!response.ok) throw new Error(`Téléchargement du modèle : ${response.status}`);
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
  }
}
console.log('Modèle et runtime disponibles localement.');

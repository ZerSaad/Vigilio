import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { observationFromLandmarks, type Point } from '../core/geometry';
import { handCoversMouth } from './hand-occlusion';
import { applyVisibility, classifyLight, enhanceLowLight, faceRegion, measureLight, suspectEyeOcclusion, type Rect } from './visibility';
import type { Lighting } from '../core/types';
let model: FaceLandmarker | null = null;
let handModel: HandLandmarker | null = null;
let hands: Point[][] = [];
let lastHandTime = -Infinity;
let region: Rect | undefined;
let lighting: Lighting = 'normal';
const scope = self as unknown as DedicatedWorkerGlobalScope;
const canvas = new OffscreenCanvas(480, 360);
const context = canvas.getContext('2d', { willReadFrequently: true })!;
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const files = await FilesetResolver.forVisionTasks(data.base + 'wasm');
      model = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: data.base + 'models/face_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1, minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6, minTrackingConfidence: 0.6, outputFacialTransformationMatrixes: true,
      });
      handModel = await HandLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: data.base + 'models/hand_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
      });
      scope.postMessage({ type: 'ready' });
    } else if (data.type === 'frame' && model) {
      const bitmap: ImageBitmap = data.bitmap;
      const start = performance.now();
      try {
        const width = Math.min(480, bitmap.width), height = Math.round(bitmap.height * width / bitmap.width);
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        context.drawImage(bitmap, 0, 0, width, height);
        const raw = context.getImageData(0, 0, width, height);
        const before = measureLight(raw, region);
        const inputLighting = classifyLight(before, lighting);
        const enhanced = inputLighting === 'low';
        if (enhanced) context.putImageData(new ImageData(enhanceLowLight(raw, before, inputLighting), width, height), 0, 0);
        // Do not run a facial model on near-black frames and mistake guessed landmarks for data.
        const result = inputLighting === 'dark' ? null : model.detectForVideo(canvas, data.time);
        const points = result?.faceLandmarks[0] ?? [];
        region = faceRegion(points);
        const stats = measureLight(raw, region);
        lighting = classifyLight(stats, lighting);
        if (lighting === 'dark' || points.length < 468) { hands = []; lastHandTime = -Infinity; }
        else if (handModel && data.time - lastHandTime >= 250) {
          hands = handModel.detectForVideo(canvas, data.time).landmarks;
          lastHandTime = data.time;
        }
        const observation = applyVisibility(
          observationFromLandmarks(points, width, height, result?.facialTransformationMatrixes[0]),
          lighting, stats, suspectEyeOcclusion(raw, points), enhanced,
        );
        observation.mouthCovered = lighting !== 'dark' && data.time - lastHandTime <= 500 && handCoversMouth(points, hands, width, height);
        if (observation.mouthCovered) observation.mouthValid = false;
        const preview = enhanced && lighting !== 'dark' ? canvas.transferToImageBitmap() : null;
        scope.postMessage({ type: 'result', observation, points, preview, time: data.time, latency: performance.now() - start }, preview ? [preview] : []);
      } finally { bitmap.close(); }
    }
  } catch (error) { scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};

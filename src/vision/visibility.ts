import type { Lighting, Observation } from '../core/types';
import type { Point } from '../core/geometry';
export interface Pixels { data: Uint8ClampedArray; width: number; height: number }
export interface Rect { x: number; y: number; width: number; height: number }
export interface LightStats { mean: number; p05: number; p95: number }
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const luminance = (data: Uint8ClampedArray, i: number) => (54 * data[i] + 183 * data[i + 1] + 19 * data[i + 2]) / 256;

export function faceRegion(points: Point[]): Rect | undefined {
  const anchors = [10, 152, 234, 454].map(i => points[i]);
  if (anchors.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return;
  const xs = anchors.map(p => p.x), ys = anchors.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  if (w < 0.08 || h < 0.08) return;
  return { x: x + w * 0.12, y: y + h * 0.12, width: w * 0.76, height: h * 0.76 };
}
export function measureLight(pixels: Pixels, region: Rect = { x: 0.25, y: 0.15, width: 0.5, height: 0.7 }): LightStats {
  const hist = new Uint32Array(256);
  const x0 = clamp(Math.floor(region.x * pixels.width), 0, pixels.width - 1);
  const y0 = clamp(Math.floor(region.y * pixels.height), 0, pixels.height - 1);
  const x1 = clamp(Math.ceil((region.x + region.width) * pixels.width), x0 + 1, pixels.width);
  const y1 = clamp(Math.ceil((region.y + region.height) * pixels.height), y0 + 1, pixels.height);
  let total = 0, count = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const value = Math.round(luminance(pixels.data, (y * pixels.width + x) * 4));
    hist[value]++; total += value; count++;
  }
  let sum = 0, p05 = 0, p95 = 255;
  for (let value = 0; value < 256; value++) { sum += hist[value]; if (sum >= count * 0.05) { p05 = value; break; } }
  sum = 0;
  for (let value = 0; value < 256; value++) { sum += hist[value]; if (sum >= count * 0.95) { p95 = value; break; } }
  return { mean: total / Math.max(count, 1), p05, p95 };
}
export function classifyLight(stats: LightStats, previous: Lighting = 'normal'): Lighting {
  if ((stats.mean < 12 && stats.p95 < 35) || stats.p95 < 20 || (stats.mean < 40 && stats.p95 - stats.p05 < 4)) return 'dark';
  return stats.mean < (previous === 'low' ? 65 : 55) && stats.p95 < (previous === 'low' ? 110 : 95) ? 'low' : 'normal';
}

/** Bounded gamma correction plus mild contrast stretch. Raw pixels are preserved
 * for visibility checks; near-black frames are never treated as recovered data. */
export function enhanceLowLight(pixels: Pixels, stats: LightStats, lighting: Lighting = classifyLight(stats)): Uint8ClampedArray {
  const output = new Uint8ClampedArray(pixels.data);
  if (lighting !== 'low') return output;
  const gamma = clamp(Math.log(90 / 255) / Math.log(Math.max(stats.mean, 1) / 255), 0.45, 0.9);
  const lookup = new Float32Array(256);
  for (let value = 0; value < 256; value++) {
    const lifted = 255 * Math.pow(value / 255, gamma);
    const stretched = clamp((value - stats.p05) * 180 / Math.max(stats.p95 - stats.p05, 30) + 20, 0, 255);
    lookup[value] = lifted * 0.85 + stretched * 0.15;
  }
  for (let i = 0; i < pixels.data.length; i += 4) {
    const y = luminance(pixels.data, i);
    const factor = Math.min(3.5, lookup[Math.round(y)] / Math.max(y, 1));
    output[i] = pixels.data[i] * factor; output[i + 1] = pixels.data[i + 1] * factor; output[i + 2] = pixels.data[i + 2] * factor;
  }
  return output;
}

/** Conservative suspicion of opaque lenses/obstruction, NOT a glasses classifier.
 * Both eye patches must be much darker than adjacent cheeks in the RAW frame. */
export function suspectEyeOcclusion(pixels: Pixels, points: Point[]): boolean {
  if (points.length < 468) return false;
  return [[33, 133], [362, 263]].every(([a, b]) => {
    const p = points[a], q = points[b];
    if (!p || !q || ![p.x,p.y,q.x,q.y].every(Number.isFinite)) return false;
    const width = Math.abs(p.x - q.x), cx = (p.x + q.x) / 2, cy = (p.y + q.y) / 2;
    const height = width * pixels.width / pixels.height;
    const eye = measureLight(pixels, { x: cx - width * 0.65, y: cy - height * 0.35, width: width * 1.3, height: height * 0.7 });
    const cheek = measureLight(pixels, { x: cx - width * 0.45, y: cy + height * 0.75, width: width * 0.9, height: height * 0.5 });
    return cheek.mean > 45 && eye.mean < 55 && eye.mean / cheek.mean < 0.48;
  });
}
export function applyVisibility(observation: Observation, lighting: Lighting, stats: LightStats, occluded: boolean, enhanced: boolean): Observation {
  if (lighting === 'dark') return { valid: false, faceValid: false, mouthValid: false, ear: 0, mouth: 0, headPitch: null, lighting, luminance: stats.mean, enhanced: false, reason: 'Éclairage insuffisant : aucun signal visuel fiable.' };
  return { ...observation, valid: observation.valid && lighting === 'normal' && !occluded, lighting, luminance: stats.mean, eyesOccluded: occluded, enhanced };
}

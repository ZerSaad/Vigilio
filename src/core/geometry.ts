import type { Observation } from './types';
import { headPitchFromMatrix } from './head-pose';
export interface Point { x: number; y: number; z?: number }
export const LEFT_EYE = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
export function observationFromLandmarks(points: Point[], width: number, height: number, matrix?: Parameters<typeof headPitchFromMatrix>[0]): Observation {
  let headPitch: number | null = null, mouth = 0, faceValid = false, mouthValid = false;
  const bad = (reason: string): Observation => ({ valid: false, faceValid, mouthValid, ear: 0, mouth, reason, headPitch });
  if (points.length < 468) return bad('Aucun visage détecté');
  const distance = (a: number, b: number) => Math.hypot((points[a].x - points[b].x) * width, (points[a].y - points[b].y) * height);
  const inside = (i: number) => points[i] && Number.isFinite(points[i].x) && Number.isFinite(points[i].y) && points[i].x > 0.015 && points[i].x < 0.985 && points[i].y > 0.015 && points[i].y < 0.985;
  if (![1, 13, 14, 61, 291, 234, 454].every(inside)) return bad('Visage partiellement hors du cadre');
  if (distance(234, 454) < width * 0.17) return bad('Rapprochez-vous de la caméra');
  faceValid = true;
  headPitch = headPitchFromMatrix(matrix);
  mouth = distance(13, 14) / Math.max(distance(61, 291), 1);
  mouthValid = distance(61, 291) > width * 0.02 && Number.isFinite(mouth) && mouth >= 0 && mouth <= 1.8;
  if (![...LEFT_EYE, ...RIGHT_EYE].every(inside)) return bad('Yeux hors du cadre ou masqués');
  if (distance(33, 263) < width * 0.11) return bad('Rapprochez-vous de la caméra');
  const leftWidth = distance(33, 133), rightWidth = distance(362, 263);
  const balance = leftWidth / Math.max(rightWidth, 1);
  if (balance < 0.5 || balance > 2) return bad('Regardez davantage face à la caméra');
  const ear = (eye: number[]) => (distance(eye[1], eye[5]) + distance(eye[2], eye[4])) / (2 * distance(eye[0], eye[3]));
  const left = ear(LEFT_EYE), right = ear(RIGHT_EYE);
  if (![left, right].every(value => Number.isFinite(value) && value >= 0 && value < 0.65)) return bad('Mesure des yeux inexploitable');
  if (Math.abs(left - right) > 0.14) return bad('Les deux yeux doivent être visibles');
  return { valid: true, faceValid: true, mouthValid, ear: (left + right) / 2, mouth, headPitch };
}

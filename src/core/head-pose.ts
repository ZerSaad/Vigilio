interface Matrix { rows: number; columns: number; data: number[] }
/** MediaPipe serializes the canonical-to-camera transform in column-major order.
 * Metric Y points up: positive rotation around X tilts the face down.
 * Reject strong side turns, roll and degenerate transforms before using pitch.
 */
export function headPitchFromMatrix(matrix?: Matrix): number | null {
  if (!matrix || matrix.rows !== 4 || matrix.columns !== 4 || matrix.data.length !== 16 || !matrix.data.every(Number.isFinite)) return null;
  const m = matrix.data;
  const scale = Math.hypot(m[0], m[1], m[2]);
  if (scale < 0.01 || scale > 100) return null;
  const yaw = Math.asin(Math.max(-1, Math.min(1, -m[2] / scale))) * 180 / Math.PI;
  const roll = Math.atan2(m[1], m[0]) * 180 / Math.PI;
  const pitch = Math.atan2(m[6], m[10]) * 180 / Math.PI;
  return Math.abs(yaw) <= 35 && Math.abs(roll) <= 35 && Math.abs(pitch) <= 75 ? pitch : null;
}

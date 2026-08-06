import { Landmark } from './types';

/*
 * MediaPipe Hands landmark indices used here:
 *  0 wrist · 3/4 thumb ip/tip · 6/8 index pip/tip
 *  10/12 middle pip/tip · 14/16 ring pip/tip · 17/18/20 pinky mcp/pip/tip
 */

export const MAX_DIGIT = 9;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Non-thumb fingers extend upward in image space (y decreases) when held up.
function isFingerExtended(tip: Landmark, pip: Landmark, margin = 0.02): boolean {
  return tip.y < pip.y - margin;
}

// The thumb moves sideways rather than up, so gauge it by how far it splays
// from the palm base instead of by vertical position.
function isThumbExtended(landmarks: Landmark[]): boolean {
  const tip = landmarks[4];
  const ip = landmarks[3];
  const palmBase = landmarks[17];
  return dist(tip, palmBase) > dist(ip, palmBase) * 1.1;
}

/** Counts extended fingers (0-5) on one hand. Returns null for malformed input. */
export function countExtendedFingers(landmarks: Landmark[]): number | null {
  if (!landmarks || landmarks.length !== 21) return null;

  const extended = [
    isThumbExtended(landmarks),
    isFingerExtended(landmarks[8], landmarks[6]),
    isFingerExtended(landmarks[12], landmarks[10]),
    isFingerExtended(landmarks[16], landmarks[14]),
    isFingerExtended(landmarks[20], landmarks[18]),
  ];

  return extended.filter(Boolean).length;
}

/**
 * Totals the fingers across every visible hand to give a digit.
 *
 * One hand tops out at 5, so digits 6-9 require both hands (6 = open palm + one
 * finger). A total of 10 is rejected rather than wrapped to 0, because 0 is
 * already an unambiguous closed fist.
 */
export function classifyHands(hands: Landmark[][]): number | null {
  if (!hands || hands.length === 0) return null;

  let total = 0;
  for (const hand of hands) {
    const count = countExtendedFingers(hand);
    if (count === null) return null;
    total += count;
  }

  return total > MAX_DIGIT ? null : total;
}

/** Back-compat helper for single-hand callers. */
export function classifyLandmarks(landmarks: Landmark[]): number | null {
  return countExtendedFingers(landmarks);
}

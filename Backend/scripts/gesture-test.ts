/**
 * Verifies the classifier can express every digit the secret code needs.
 * Digits 6-9 are only reachable with two hands, which is what broke code "2026"
 * when the tracker was limited to one hand.
 *
 * Run with: npm run test:gesture
 */
import assert from 'node:assert/strict';
import { classifyHands } from '../src/gesture/classify';
import type { Landmark } from '../src/gesture/types';

const lm = (x: number, y: number): Landmark => ({ x, y, z: 0 });

/** Builds a synthetic 21-point hand with the requested fingers extended. */
function hand(fingers: [boolean, boolean, boolean, boolean, boolean]): Landmark[] {
  const wrist = lm(0.5, 0.9);
  const thumb = [
    lm(0.45, 0.85), lm(0.4, 0.8), lm(0.35, 0.75),
    fingers[0] ? lm(0.25, 0.7) : lm(0.42, 0.78),
  ];
  const finger = (x: number, up: boolean) => [
    lm(x, 0.6), lm(x, 0.5), lm(x, 0.4), up ? lm(x, 0.28) : lm(x, 0.55),
  ];
  return [
    wrist, ...thumb,
    ...finger(0.45, fingers[1]), ...finger(0.5, fingers[2]),
    ...finger(0.55, fingers[3]), ...finger(0.6, fingers[4]),
  ];
}

const N = (n: number) => hand([n >= 5, n >= 1, n >= 2, n >= 3, n >= 4] as [boolean, boolean, boolean, boolean, boolean]);
const FIST = hand([false, false, false, false, false]);
const PALM = hand([true, true, true, true, true]);

let pass = 0;
const fail: string[] = [];
function check(name: string, fn: () => void) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail.push(name); console.log(`  ✗ ${name}\n      ${(e as Error).message.split('\n')[0]}`); }
}

console.log('\nGesture classification\n');

check('no hands reads as no digit', () => assert.equal(classifyHands([]), null));
check('fist reads 0', () => assert.equal(classifyHands([FIST]), 0));

for (let d = 1; d <= 5; d++) {
  check(`one hand reads ${d}`, () => assert.equal(classifyHands([N(d)]), d));
}

// The digits that were unreachable before two-hand support.
for (let d = 6; d <= 9; d++) {
  check(`two hands read ${d} (palm + ${d - 5})`, () =>
    assert.equal(classifyHands([PALM, N(d - 5)]), d));
}

check('ten fingers is rejected, not wrapped to 0', () =>
  assert.equal(classifyHands([PALM, PALM]), null));

check('every digit of the secret code 2026 is expressible', () => {
  const combos: Record<string, Landmark[][]> = {
    '2': [N(2)], '0': [FIST], '6': [PALM, N(1)],
  };
  for (const digit of '2026') {
    assert.equal(String(classifyHands(combos[digit])), digit, `digit ${digit} not reachable`);
  }
});

console.log(`\n${pass} passed, ${fail.length} failed`);
if (fail.length) process.exit(1);

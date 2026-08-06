import { classifyHands } from './classify';
import { ConfirmedMessage, Landmark, PreviewMessage } from './types';

const STABLE_FRAMES_REQUIRED = 8;
const CONFIRM_COOLDOWN_MS = 900;

/**
 * Per-connection debounce: a digit only counts once it has been read
 * consistently for several consecutive frames, and confirmations are
 * rate-limited so holding a pose doesn't spam repeat entries.
 */
export class GestureSession {
  private lastDigit: number | null = null;
  private stableCount = 0;
  private cooldownUntil = 0;

  processHands(hands: Landmark[][]): {
    preview: PreviewMessage;
    confirmed: ConfirmedMessage | null;
  } {
    const digit = hands.length ? classifyHands(hands) : null;

    if (digit === this.lastDigit) {
      this.stableCount++;
    } else {
      this.lastDigit = digit;
      this.stableCount = digit === null ? 0 : 1;
    }

    const progress =
      digit === null
        ? 0
        : Math.min(100, Math.round((this.stableCount / STABLE_FRAMES_REQUIRED) * 100));
    const preview: PreviewMessage = {
      type: 'preview',
      digit,
      progress,
      handsSeen: hands.length,
    };

    let confirmed: ConfirmedMessage | null = null;
    const now = Date.now();
    if (digit !== null && this.stableCount >= STABLE_FRAMES_REQUIRED && now >= this.cooldownUntil) {
      confirmed = { type: 'confirmed', digit };
      this.cooldownUntil = now + CONFIRM_COOLDOWN_MS;
      this.stableCount = 0; // require the gesture to be re-held before it can confirm again
    }

    return { preview, confirmed };
  }
}

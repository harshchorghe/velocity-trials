export interface Landmark {
  x: number;
  y: number;
  z: number;
}

/**
 * Client -> server: the MediaPipe hand landmarks for this frame.
 *
 * `hands` carries one 21-point entry per detected hand (0-2 of them). Digits
 * above 5 need both hands — 6 is a full palm plus one finger — so a single-hand
 * payload can never express the whole 0-9 range.
 *
 * `landmarks` is the older single-hand field, still accepted so an outdated
 * client keeps working.
 */
export interface LandmarksMessage {
  type: 'landmarks';
  hands?: Landmark[][];
  landmarks?: Landmark[];
}

export interface ClearMessage {
  type: 'clear';
}

export type ClientMessage = LandmarksMessage | ClearMessage;

/** Server -> client: continuous feedback while a gesture is being held. */
export interface PreviewMessage {
  type: 'preview';
  digit: number | null;
  progress: number; // 0-100, how close the held gesture is to being confirmed
  handsSeen: number;
}

/** Server -> client: the gesture was held steadily for long enough to accept. */
export interface ConfirmedMessage {
  type: 'confirmed';
  digit: number;
}

export type ServerMessage = PreviewMessage | ConfirmedMessage;

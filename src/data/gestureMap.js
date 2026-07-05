// Maps MediaPipe's built-in gesture classes to spoken/written phrases.
// The GestureRecognizer task ships a pre-trained TFLite model recognizing
// these 7 categories out of the box (plus "None"). This file is the single
// place that turns a raw model label into something a human reads/hears,
// which keeps the recognition logic and the "vocabulary" of the app decoupled.

export const GESTURE_MAP = {
  Thumb_Up: { text: 'Yes', emoji: '👍' },
  Thumb_Down: { text: 'No', emoji: '👎' },
  Open_Palm: { text: 'Hello', emoji: '✋' },
  Closed_Fist: { text: 'Stop', emoji: '✊' },
  Victory: { text: 'Peace', emoji: '✌️' },
  Pointing_Up: { text: 'Wait', emoji: '☝️' },
  ILoveYou: { text: 'I love you', emoji: '🤟' },
};

export function resolveGesture(categoryName) {
  return GESTURE_MAP[categoryName] || null;
}

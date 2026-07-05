// Thin wrapper around the browser's SpeechSynthesis API (part of the
// Web Speech API). Kept separate from React so it can be unit-tested
// and swapped out without touching component logic.

let voices = [];

function loadVoices() {
  voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  return voices;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text, { rate = 1, pitch = 1 } = {}) {
  if (!isSpeechSupported() || !text) return;

  // Cancel anything mid-utterance so gestures don't queue up and
  // "talk over" each other during continuous webcam use.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;

  const preferred = voices.find((v) => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

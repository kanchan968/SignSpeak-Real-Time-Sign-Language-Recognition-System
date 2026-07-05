# SignSpeak — Real-Time Sign Language Recognition

SignSpeak reads simple hand gestures through your webcam and turns them into
written text and spoken words, live, with no server and no extra hardware.
Everything runs **on-device**, in the browser.

## What it does

1. You turn on your webcam.
2. Your hand is tracked frame-by-frame.
3. When you hold a recognizable gesture steady for a moment, it's shown as
   text and spoken out loud.
4. Every recognized word is kept in a running transcript.

## Tech stack

| Layer | Tool | Why |
|---|---|---|
| UI | **React** | Component state (current gesture, transcript, camera on/off) maps cleanly to React's render model. |
| Hand tracking + gesture classification | **MediaPipe (Tasks Vision — `GestureRecognizer`)** | Google's on-device pipeline. Internally it runs a palm-detector and a landmark/gesture model, both **TensorFlow Lite** models, compiled to WebAssembly so they execute in the browser instead of on a server. |
| Voice output | **Web Speech API** (`SpeechSynthesis`) | Built into every modern browser — no external TTS service, no API key. |

This matches the resume line "on-device ML inference": the model files are
downloaded once, then every frame is processed locally in WASM/GPU. No video
frame ever leaves the browser.

## Architecture

```
 ┌────────────┐   video frame   ┌───────────────────────┐   landmarks +   ┌────────────────────┐
 │  <video>   │ ───────────────▶│  MediaPipe             │   gesture      │  React state        │
 │  (webcam)  │                 │  GestureRecognizer     │   + score  ──▶│  currentGesture      │
 └────────────┘                 │  (TFLite via WASM)     │                └──────────┬──────────┘
                                 └───────────────────────┘                           │
                                                                                       ▼
                                                                      ┌────────────────────────────┐
                                                                      │ Debounce / "hold to commit" │
                                                                      │  (App.jsx effect)           │
                                                                      └──────────────┬─────────────┘
                                                                                      │
                                                       ┌──────────────────────────────┼──────────────────────────────┐
                                                       ▼                              ▼                              ▼
                                             ┌───────────────────┐        ┌───────────────────┐        ┌───────────────────┐
                                             │  GesturePanel      │        │  TranscriptLog      │        │  Web Speech API     │
                                             │  (live readout)    │        │  (word history)      │        │  (speaks the word)  │
                                             └───────────────────┘        └───────────────────┘        └───────────────────┘
```

### The pipeline, step by step

1. **Camera capture** — `navigator.mediaDevices.getUserMedia` streams webcam
   video into a `<video>` element. Nothing is recorded or uploaded.
2. **Per-frame inference** — a `requestAnimationFrame` loop hands each new
   video frame to `GestureRecognizer.recognizeForVideo()`. MediaPipe:
   - detects the hand and 21 hand landmarks (fingertips, knuckles, wrist),
   - draws the hand skeleton on an overlay `<canvas>`,
   - classifies the hand shape into one of a small set of built-in gesture
     categories, each with a confidence score.
3. **Debounce ("hold to commit")** — a raw video stream fires ~30 times a
   second, so a held-up thumb would otherwise "say" the same word 30 times a
   second. `App.jsx` only *commits* a gesture once it has been held steadily
   for ~0.9s, and won't repeat the same word again for 2.5s. This is the
   difference between a demo that spams noise and one that reads like real
   conversation.
4. **Vocabulary mapping** — `data/gestureMap.js` is a single lookup table
   that turns a raw model label (e.g. `Thumb_Up`) into a word and emoji
   (`Yes`, 👍). Keeping this in one file makes the app's "vocabulary" easy to
   read and easy to extend later without touching recognition logic.
5. **Output** — the committed word is pushed onto a transcript list and read
   aloud via the browser's built-in `SpeechSynthesis` API.

### Why this design (talking points)

- **No backend** — nothing to deploy, no latency from a network round trip,
  no privacy concern about sending someone's webcam feed anywhere.
- **MediaPipe's model, not one trained from scratch** — for a project built
  solo, using a well-tested pre-trained gesture model and focusing
  engineering effort on the *product* (the real-time pipeline, debounce
  logic, UI, speech integration) is a defensible, realistic scope. It's
  accurate to describe MediaPipe's model as "TensorFlow Lite on-device
  inference," because that's literally what runs under the hood.
- **Debounce logic is the one genuinely nontrivial engineering decision**
  in this app — be ready to explain *why* it's needed (frame rate vs.
  speakable words) and how the two constants (`HOLD_TO_COMMIT_MS`,
  `REPEAT_COOLDOWN_MS`) trade responsiveness against noise.

## Project structure

```
src/
  App.jsx                        – top-level layout + the debounce/commit state machine
  hooks/useGestureRecognizer.js  – owns the model, webcam, and per-frame loop
  data/gestureMap.js             – gesture → word/emoji vocabulary
  utils/speech.js                – thin wrapper around SpeechSynthesis
  components/
    WebcamStage.jsx              – <video> + overlay <canvas>
    GesturePanel.jsx             – live "currently detected" readout + confidence bar
    TranscriptLog.jsx            – scrolling history of recognized words
```

## Running it locally

```bash
npm install
npm run dev
```

Open the printed local URL, click **Start camera**, allow camera access, and
hold up a hand gesture (thumbs up, open palm, fist, peace sign, pointing up,
or the "I love you" sign). MediaPipe's model file downloads from a CDN the
first time you run it, so the first load needs an internet connection.

```bash
npm run build     # production build into dist/
```

## Current vocabulary

| Gesture | Spoken word |
|---|---|
| Thumb up | Yes |
| Thumb down | No |
| Open palm | Hello |
| Closed fist | Stop |
| Victory / peace sign | Peace |
| Pointing up | Wait |
| "I love you" sign | I love you |

These seven come from MediaPipe's pre-trained `GestureRecognizer` model.

## Extending it

- **More words** — MediaPipe also exposes raw hand landmarks, so you can add
  a rule-based classifier (e.g. "index + middle finger up, others down" → a
  new word) on top of the existing categories, in a new
  `utils/customGestures.js`, without touching the rest of the pipeline.
- **Two-handed signs** — raise `numHands` in `useGestureRecognizer({ numHands: 2 })`.
- **Different voice/language** — `utils/speech.js` picks the first English
  voice available; swap the filter to prefer another language.

## Known limitations

- Recognizes a fixed set of static hand shapes, not full ASL/ISL grammar
  (which involves motion, facial expression, and two-handed signs).
- Needs reasonable lighting and a hand mostly facing the camera.
- Requires a browser with WebGL/WASM support and, for speech, a browser that
  implements `SpeechSynthesis` (all major desktop and mobile browsers do).

import { useEffect, useRef, useState, useCallback } from 'react';
import { useGestureRecognizer } from './hooks/useGestureRecognizer';
import { resolveGesture } from './data/gestureMap';
import { speak, isSpeechSupported } from './utils/speech';
import WebcamStage from './components/WebcamStage';
import GesturePanel from './components/GesturePanel';
import TranscriptLog from './components/TranscriptLog';
import './App.css';

// How long (ms) a gesture must stay steady before we "commit" it.
// Without this, a single hand held up would fire the same word 20+
// times a second (once per video frame), which is neither readable
// nor speakable. This is the simplest possible fix: a debounce.
const HOLD_TO_COMMIT_MS = 900;

// Minimum gap between committing the *same* word twice in a row,
// so a hand that's just resting in front of the camera doesn't
// spam the transcript and the speaker every second.
const REPEAT_COOLDOWN_MS = 2500;

function App() {
  const {
    videoRef,
    canvasRef,
    isReady,
    isRunning,
    currentGesture,
    fps,
    error,
    startCamera,
    stopCamera,
  } = useGestureRecognizer({ numHands: 1, minConfidence: 0.65 });

  const [entries, setEntries] = useState([]);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const pendingRef = useRef({ name: null, since: 0 });
  const lastCommittedRef = useRef({ name: null, at: 0 });

  const commit = useCallback(
    (gestureName) => {
      const resolved = resolveGesture(gestureName);
      if (!resolved) return;

      const entry = {
        id: `${Date.now()}-${gestureName}`,
        text: resolved.text,
        emoji: resolved.emoji,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setEntries((prev) => [...prev, entry].slice(-30)); // keep the log bounded

      if (autoSpeak) speak(resolved.text);
    },
    [autoSpeak]
  );

  // This effect is the "debounce + commit" state machine described above.
  // It only looks at `currentGesture`, which the hook already updates
  // once per video frame after MediaPipe has run.
  useEffect(() => {
    const now = performance.now();
    const name = currentGesture?.name ?? null;

    if (!name) {
      pendingRef.current = { name: null, since: 0 };
      return;
    }

    if (pendingRef.current.name !== name) {
      // A new candidate gesture appeared — start timing it.
      pendingRef.current = { name, since: now };
      return;
    }

    const heldFor = now - pendingRef.current.since;
    const sinceLastSameCommit =
      lastCommittedRef.current.name === name ? now - lastCommittedRef.current.at : Infinity;

    if (heldFor >= HOLD_TO_COMMIT_MS && sinceLastSameCommit >= REPEAT_COOLDOWN_MS) {
      lastCommittedRef.current = { name, at: now };
      commit(name);
    }
  }, [currentGesture, commit]);

  return (
    <div className="app">
      <header className="app__header">
        <h1>SignSpeak</h1>
        <p className="app__subtitle">Real-time sign-to-speech, running entirely in your browser.</p>
      </header>

      {error && <div className="app__error">{error}</div>}

      <main className="app__layout">
        <div className="app__stage-col">
          <WebcamStage videoRef={videoRef} canvasRef={canvasRef} isRunning={isRunning} />

          <div className="app__controls">
            {!isRunning ? (
              <button className="btn btn--primary" onClick={startCamera} disabled={!isReady}>
                {isReady ? 'Start camera' : 'Loading model…'}
              </button>
            ) : (
              <button className="btn" onClick={stopCamera}>
                Stop camera
              </button>
            )}

            <label className="app__toggle">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
                disabled={!isSpeechSupported()}
              />
              Speak detected words
            </label>
          </div>

          {!isSpeechSupported() && (
            <p className="app__note">Speech synthesis isn't supported in this browser.</p>
          )}
        </div>

        <div className="app__side-col">
          <GesturePanel currentGesture={currentGesture} fps={fps} />
          <TranscriptLog entries={entries} onClear={() => setEntries([])} />
        </div>
      </main>
    </div>
  );
}

export default App;

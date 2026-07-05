import { useEffect, useRef, useState, useCallback } from 'react';
import { GestureRecognizer, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

/**
 * useGestureRecognizer
 * ---------------------------------------------------------------
 * Owns the full on-device inference pipeline:
 *
 *   webcam <video> frame
 *        -> GestureRecognizer.recognizeForVideo()   [MediaPipe C++/WASM engine]
 *        -> hand landmarks (21 points per hand)      [runs a TFLite palm-detector
 *        -> gesture classification logits             + landmark + gesture-embedding
 *        -> top category + confidence score           model, all in WASM/GPU, on-device]
 *
 * This runs entirely in the browser: no frame is ever sent to a server,
 * which is what makes "low-latency" and "no external hardware" true
 * claims rather than marketing language.
 *
 * Returns refs to attach to a <video> + <canvas>, plus live state
 * (currentGesture, landmarks, isReady, fps) for the UI to render.
 */
export function useGestureRecognizer({ numHands = 1, minConfidence = 0.6 } = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognizerRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentGesture, setCurrentGesture] = useState(null); // { name, score }
  const [fps, setFps] = useState(0);
  const [error, setError] = useState(null);

  // ---- 1. Load the model (once) ---------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Loads the WASM runtime that executes the TFLite model graph.
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
            delegate: 'GPU', // falls back to CPU automatically if unavailable
          },
          runningMode: 'VIDEO',
          numHands,
        });

        if (!cancelled) {
          recognizerRef.current = recognizer;
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load gesture model');
      }
    }

    init();
    return () => {
      cancelled = true;
      recognizerRef.current?.close();
    };
  }, [numHands]);

  // ---- 2. Start the webcam ----------------------------------------------
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setIsRunning(true);
    } catch {
      setError('Camera access was denied or is unavailable.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRunning(false);
    setCurrentGesture(null);
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
  }, []);

  // ---- 3. Per-frame inference loop --------------------------------------
  useEffect(() => {
    if (!isReady || !isRunning) return;

    let frameCount = 0;
    let lastFpsTime = performance.now();

    const drawingUtils = canvasRef.current
      ? new DrawingUtils(canvasRef.current.getContext('2d'))
      : null;

    const loop = () => {
      const video = videoRef.current;
      const recognizer = recognizerRef.current;

      if (video && recognizer && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        const nowMs = performance.now();
        const result = recognizer.recognizeForVideo(video, nowMs);

        // --- draw hand skeleton on the overlay canvas ---
        if (canvasRef.current && drawingUtils) {
          const ctx = canvasRef.current.getContext('2d');
          canvasRef.current.width = video.videoWidth;
          canvasRef.current.height = video.videoHeight;
          ctx.save();
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          for (const landmarks of result.landmarks) {
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
              color: '#5EEAD4',
              lineWidth: 3,
            });
            drawingUtils.drawLandmarks(landmarks, { color: '#F97362', radius: 3 });
          }
          ctx.restore();
        }

        // --- pick the top gesture above the confidence threshold ---
        const top = result.gestures?.[0]?.[0];
        if (top && top.score >= minConfidence && top.categoryName !== 'None') {
          setCurrentGesture({ name: top.categoryName, score: top.score });
        } else {
          setCurrentGesture(null);
        }

        // --- fps counter (helps demonstrate "low latency" with a number) ---
        frameCount += 1;
        if (nowMs - lastFpsTime >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          lastFpsTime = nowMs;
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [isReady, isRunning, minConfidence]);

  return {
    videoRef,
    canvasRef,
    isReady,
    isRunning,
    currentGesture,
    fps,
    error,
    startCamera,
    stopCamera,
  };
}

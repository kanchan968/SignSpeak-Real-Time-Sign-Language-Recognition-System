import { resolveGesture } from '../data/gestureMap';

export default function GesturePanel({ currentGesture, fps }) {
  const resolved = currentGesture ? resolveGesture(currentGesture.name) : null;

  return (
    <div className="panel">
      <div className="panel__row panel__row--top">
        <span className="panel__label">Detected sign</span>
        <span className="panel__fps">{fps} fps</span>
      </div>

      <div className="panel__readout">
        {resolved ? (
          <>
            <span className="panel__emoji">{resolved.emoji}</span>
            <span className="panel__text">{resolved.text}</span>
          </>
        ) : (
          <span className="panel__text panel__text--idle">—</span>
        )}
      </div>

      <div className="panel__confidence">
        <div
          className="panel__confidence-fill"
          style={{ width: `${currentGesture ? currentGesture.score * 100 : 0}%` }}
        />
      </div>
      <span className="panel__confidence-label">
        {currentGesture ? `${Math.round(currentGesture.score * 100)}% confidence` : 'No hand detected'}
      </span>
    </div>
  );
}

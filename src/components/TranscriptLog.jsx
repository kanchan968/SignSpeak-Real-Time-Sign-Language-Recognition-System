export default function TranscriptLog({ entries, onClear }) {
  return (
    <div className="transcript">
      <div className="transcript__header">
        <span>Transcript</span>
        {entries.length > 0 && (
          <button className="transcript__clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <div className="transcript__body">
        {entries.length === 0 && <p className="transcript__empty">Recognized signs will appear here.</p>}
        {entries.map((entry) => (
          <div key={entry.id} className="transcript__entry">
            <span className="transcript__emoji">{entry.emoji}</span>
            <span className="transcript__word">{entry.text}</span>
            <span className="transcript__time">{entry.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

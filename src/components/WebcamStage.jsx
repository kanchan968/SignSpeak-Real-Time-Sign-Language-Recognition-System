export default function WebcamStage({ videoRef, canvasRef, isRunning }) {
  return (
    <div className="stage">
      <video ref={videoRef} className="stage__video" playsInline muted />
      <canvas ref={canvasRef} className="stage__canvas" />
      {!isRunning && (
        <div className="stage__placeholder">
          <span className="stage__placeholder-icon">✋</span>
          <p>Camera is off</p>
        </div>
      )}
    </div>
  );
}

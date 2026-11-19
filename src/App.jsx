import { useRef, useState } from "react";
import SpinningRose from "./SpinningRose.jsx";

export default function App() {
  const canvasRef = useRef(null);
  const [density, setDensity] = useState(1);
  const [speed, setSpeed] = useState(0.6);
  const [replayKey, setReplayKey] = useState(0);
  const [recording, setRecording] = useState(false);

  const record = () => {
    const mime = ["video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(canvasRef.current.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(chunks, { type: "video/webm" })); a.download = "ascii-rose.webm"; a.click(); setRecording(false); };
    setReplayKey((k) => k + 1); setRecording(true); rec.start();
    setTimeout(() => rec.stop(), 20000);
  };

  return (
    <div className="app">
      <SpinningRose {...{ density, speed, replayKey, canvasRef }} handle="@your_handle" />
      <div className="panel">
        <label>detail <input type="range" min="0.6" max="1.8" step="0.1" value={density} onChange={(e) => setDensity(+e.target.value)} /></label>
        <label>spin <input type="range" min="0" max="2" step="0.1" value={speed} onChange={(e) => setSpeed(+e.target.value)} /></label>
        <div className="row">
          <button onClick={() => setReplayKey((k) => k + 1)}>replay</button>
          <button onClick={record} disabled={recording}>{recording ? "recording 20s…" : "record .webm"}</button>
        </div>
      </div>
    </div>
  );
}

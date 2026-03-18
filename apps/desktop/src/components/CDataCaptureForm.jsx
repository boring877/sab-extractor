import PathPicker from "./PathPicker.jsx";

export default function CDataCaptureForm({
  captureOutputDir,
  setCaptureOutputDir,
  processName,
  setProcessName,
  probeScriptPath,
  setProbeScriptPath,
  capturePid,
  setCapturePid,
  onBrowseOutputDir,
  onBrowseProbeScriptDir,
  onRunCapture,
  running,
  canRunCapture,
  status
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Frida CData Capture</h3>
        <span className="card-badge">IL2CPP</span>
      </div>

      <div className="form-grid">
        <PathPicker
          label="Output Directory"
          value={captureOutputDir}
          onChange={setCaptureOutputDir}
          onBrowse={onBrowseOutputDir}
          placeholder="D:\...\output\captured"
          disabled={running}
        />

        <PathPicker
          label="Probe Script"
          value={probeScriptPath}
          onChange={setProbeScriptPath}
          onBrowse={onBrowseProbeScriptDir}
          placeholder="D:\...\probes\cdata_probe.js"
          disabled={running}
        />

        <div className="form-group">
          <label className="form-label">Process Name</label>
          <input
            value={processName}
            onChange={(e) => setProcessName(e.target.value)}
            placeholder="SilverAndBlood.exe"
            disabled={running}
          />
        </div>

        <div className="form-group">
          <label className="form-label">PID Override</label>
          <input
            value={capturePid}
            onChange={(e) => setCapturePid(e.target.value)}
            placeholder="Auto-detect"
            disabled={running}
          />
        </div>
      </div>

      <div className="actions-bar">
        {running ? (
          <button className="btn btn-danger" onClick={onRunCapture}>
            Stop Capture
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onRunCapture} disabled={!canRunCapture}>
            Start Capture
          </button>
        )}
        <div className="status-indicator">
          {status}
        </div>
      </div>
    </div>
  );
}

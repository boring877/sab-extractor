import PathPicker from "./PathPicker.jsx";

export default function StoryExtractionForm({
  gamePath,
  outputDir,
  setGamePath,
  setOutputDir,
  onBrowseGamePath,
  onBrowseOutputDir,
  onExecute,
  running,
  canRun,
  status
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Story Extraction</h3>
        <span className="card-badge">AllLanguageEN</span>
      </div>

      <div className="form-grid">
        <PathPicker
          label="Game Path"
          value={gamePath}
          onChange={setGamePath}
          onBrowse={onBrowseGamePath}
          placeholder="C:\Program Files (x86)\Silver And Blood"
          disabled={running}
        />

        <PathPicker
          label="Output Directory"
          value={outputDir}
          onChange={setOutputDir}
          onBrowse={onBrowseOutputDir}
          placeholder="D:\...\output\stories"
          disabled={running}
        />
      </div>

      <div className="actions-bar">
        {running ? (
          <button className="btn btn-danger" onClick={onExecute}>
            Stop
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onExecute} disabled={!canRun}>
            Extract Stories
          </button>
        )}
        <div className="status-indicator">
          {status}
        </div>
      </div>
    </div>
  );
}

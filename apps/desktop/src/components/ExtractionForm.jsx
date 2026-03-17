import PathPicker from "./PathPicker.jsx";

export default function ExtractionForm({
  gamePath,
  outputDir,
  profile,
  nameFilter,
  setGamePath,
  setOutputDir,
  setProfile,
  setNameFilter,
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
        <h3>Unity Image Extraction</h3>
        <span className="card-badge">AssetBundle</span>
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
          placeholder="D:\...\output\unity_images"
          disabled={running}
        />

        <div className="form-group">
          <label className="form-label">Profile</label>
          <select value={profile} onChange={(e) => setProfile(e.target.value)} disabled={running}>
            <option value="core">core (common atlas set)</option>
            <option value="all-ui">all-ui (all UI bundles)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Name Filter</label>
          <input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Noah, Skill, Break"
            disabled={running}
          />
        </div>
      </div>

      <div className="actions-bar">
        {running ? (
          <button className="btn btn-danger" onClick={onExecute}>
            Stop
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onExecute} disabled={!canRun}>
            Start Extraction
          </button>
        )}
        <div className="status-indicator">
          {status}
        </div>
      </div>
    </div>
  );
}

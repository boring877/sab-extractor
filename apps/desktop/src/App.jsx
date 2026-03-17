import { useState } from "react";
import { pickFile, pickFolder } from "./api/desktopApi.js";
import CDataCaptureForm from "./components/CDataCaptureForm.jsx";
import ExtractionForm from "./components/ExtractionForm.jsx";
import StoryExtractionForm from "./components/StoryExtractionForm.jsx";
import LogPanel from "./components/LogPanel.jsx";
import { useExtractionRunner } from "./hooks/useExtractionRunner.js";

const TABS = [
  { id: "capture", label: "CData Capture", icon: "\u{1F4CA}" },
  { id: "extraction", label: "Image Extraction", icon: "\u{1F5BC}" },
  { id: "stories", label: "Story Extraction", icon: "\u{1F4D6}" },
  { id: "logs", label: "Run Logs", icon: "\u{1F4CB}" },
];

export default function App() {
  const runner = useExtractionRunner();
  const [activeTab, setActiveTab] = useState("capture");

  async function browseGamePath() {
    const selected = await pickFolder();
    if (selected) runner.setGamePath(selected);
  }

  async function browseOutputDir() {
    const selected = await pickFolder();
    if (selected) runner.setImageOutputDir(selected);
  }

  async function browseCaptureOutputDir() {
    const selected = await pickFolder();
    if (selected) runner.setCaptureOutputDir(selected);
  }

  async function browseProbeScriptPath() {
    const selected = await pickFile({
      filters: [{ name: "JavaScript", extensions: ["js"] }]
    });
    if (selected) runner.setProbeScriptPath(selected);
  }

  async function browseStoryOutputDir() {
    const selected = await pickFolder();
    if (selected) runner.setStoryOutputDir(selected);
  }

  function statusClass() {
    if (runner.running) return "running";
    if (runner.logs.length > 2) return "";
    return "idle";
  }

  function statusLabel() {
    if (runner.running) return "Running";
    if (runner.logs.length > 2) return "Ready";
    return "Idle";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>SAB Extractor</h1>
          <div className="subtitle">Silver and Blood Next</div>
        </div>

        <nav className="nav-section">
          <div className="nav-section-title">Tools</div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-badge">
            <span className={`status-dot ${statusClass()}`} />
            {statusLabel()}
          </div>
        </div>
      </aside>

      <div className="main-content">
        <div className="content-header">
          <h2>
            {TABS.find((t) => t.id === activeTab)?.icon}{" "}
            {TABS.find((t) => t.id === activeTab)?.label}
          </h2>
          <p>
            {activeTab === "capture" &&
              "Attach Frida to the running game and capture CData tables."}
            {activeTab === "extraction" &&
              "Extract sprite and atlas images from Unity bundles."}
            {activeTab === "stories" &&
              "Extract character journal stories from the localization bundle."}
            {activeTab === "logs" &&
              "View output from engine commands."}
          </p>
        </div>

        <div className="content-scroll">
          {activeTab === "capture" && (
            <CDataCaptureForm
              captureOutputDir={runner.captureOutputDir}
              setCaptureOutputDir={runner.setCaptureOutputDir}
              processName={runner.processName}
              setProcessName={runner.setProcessName}
              probeScriptPath={runner.probeScriptPath}
              setProbeScriptPath={runner.setProbeScriptPath}
              capturePid={runner.capturePid}
              setCapturePid={runner.setCapturePid}
              onBrowseOutputDir={browseCaptureOutputDir}
              onBrowseProbeScriptDir={browseProbeScriptPath}
              onRunCapture={runner.running ? runner.stopRunning : runner.runCapture}
              running={runner.running}
              canRunCapture={runner.canRunCapture}
              status={runner.status}
            />
          )}
          {activeTab === "extraction" && (
            <ExtractionForm
              gamePath={runner.gamePath}
              outputDir={runner.imageOutputDir}
              profile={runner.profile}
              nameFilter={runner.nameFilter}
              setGamePath={runner.setGamePath}
              setOutputDir={runner.setImageOutputDir}
              setProfile={runner.setProfile}
              setNameFilter={runner.setNameFilter}
              onBrowseGamePath={browseGamePath}
              onBrowseOutputDir={browseOutputDir}
              onExecute={runner.running ? runner.stopRunning : runner.runImages}
              running={runner.running}
              canRun={runner.canRunImage}
              status={runner.status}
            />
          )}
          {activeTab === "stories" && (
            <StoryExtractionForm
              gamePath={runner.gamePath}
              outputDir={runner.storyOutputDir}
              setGamePath={runner.setGamePath}
              setOutputDir={runner.setStoryOutputDir}
              onBrowseGamePath={browseGamePath}
              onBrowseOutputDir={browseStoryOutputDir}
              onExecute={runner.running ? runner.stopRunning : runner.runStories}
              running={runner.running}
              canRun={runner.canRunStory}
              status={runner.status}
            />
          )}
          {activeTab === "logs" && (
            <LogPanel logs={runner.logs} />
          )}
        </div>

        {activeTab !== "logs" && (
          <LogPanel logs={runner.logs} compact />
        )}
      </div>
    </div>
  );
}

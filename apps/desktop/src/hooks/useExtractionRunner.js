import { useEffect, useMemo, useState } from "react";
import {
  getBridge,
  getDefaults,
  runCDataCapture,
  runImageExtraction,
  runStoryExtraction,
  stopProcess,
  subscribeExtractionLogs,
  subscribeExtractionState
} from "../api/desktopApi.js";

function withMaxLogLines(lines, nextLine) {
  const next = [...lines, nextLine];
  return next.slice(-500);
}

export function useExtractionRunner() {
  const [defaults, setDefaults] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState([]);

  const [gamePath, setGamePath] = useState("");
  const [imageOutputDir, setImageOutputDir] = useState("");
  const [profile, setProfile] = useState("core");
  const [nameFilter, setNameFilter] = useState("");

  const [captureOutputDir, setCaptureOutputDir] = useState("");
  const [processName, setProcessName] = useState("SilverAndBlood.exe");
  const [probeScriptPath, setProbeScriptPath] = useState("");
  const [capturePid, setCapturePid] = useState("");

  const [storyOutputDir, setStoryOutputDir] = useState("");

  useEffect(() => {
    let offLog = () => {};
    let offState = () => {};

    getDefaults().then((value) => {
      if (!value) return;
      setDefaults(value);
      setGamePath(value.defaultGamePath || "");
      setImageOutputDir(value.defaultImageOutputDir || "");
      setCaptureOutputDir(value.defaultCaptureOutputDir || "");
      setProcessName(value.defaultProcessName || "SilverAndBlood.exe");
      setProbeScriptPath(value.defaultProbeScriptPath || "");
      setStoryOutputDir(value.defaultStoryOutputDir || "");
      setLogs((current) =>
        withMaxLogLines(current, `Workspace: ${value.workspaceRoot}`)
      );
    });

    offLog = subscribeExtractionLogs((line) => {
      setLogs((current) => withMaxLogLines(current, line));
    });

    offState = subscribeExtractionState((state) => {
      if (!state) return;
      setRunning(state.running === true);
      if (state.status) setStatus(state.status);
    });

    return () => {
      offLog();
      offState();
    };
  }, []);

  const canRunImage = useMemo(
    () => Boolean(getBridge()) && !running && gamePath.trim() && imageOutputDir.trim(),
    [running, gamePath, imageOutputDir]
  );

  const canRunCapture = useMemo(
    () => Boolean(getBridge()) && !running && captureOutputDir.trim(),
    [running, captureOutputDir]
  );

  const canRunStory = useMemo(
    () => Boolean(getBridge()) && !running && gamePath.trim() && storyOutputDir.trim(),
    [running, gamePath, storyOutputDir]
  );

  async function runImages() {
    const filters = nameFilter
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    setLogs((current) => withMaxLogLines(current, "Starting Unity image extraction..."));

    const result = await runImageExtraction({
      gamePath,
      outputDir: imageOutputDir,
      profile,
      nameFilters: filters
    });

    if (!result.ok) {
      setLogs((current) =>
        withMaxLogLines(current, `ERROR: ${result.error || "Unknown error"}`)
      );
      return;
    }

    setLogs((current) =>
      withMaxLogLines(current, `Image extraction finished with exit code ${result.exitCode}`)
    );
  }

  async function runCapture() {
    const pid = Number.parseInt(String(capturePid).trim(), 10);

    setLogs((current) => withMaxLogLines(current, "Starting Frida CData capture..."));

    const result = await runCDataCapture({
      outputDir: captureOutputDir,
      processName,
      probeScript: probeScriptPath,
      pid: Number.isFinite(pid) && pid > 0 ? pid : undefined
    });

    if (!result.ok) {
      setLogs((current) =>
        withMaxLogLines(current, `ERROR: ${result.error || "Unknown error"}`)
      );
      return;
    }

    setLogs((current) =>
      withMaxLogLines(current, `CData capture finished with exit code ${result.exitCode}`)
    );
  }

  async function stopRunning() {
    setLogs((current) => withMaxLogLines(current, "Stopping..."));
    const result = await stopProcess();
    if (!result.ok) {
      setLogs((current) =>
        withMaxLogLines(current, `ERROR: ${result.error || "Failed to stop"}`)
      );
    }
  }

  async function runStories() {
    setLogs((current) => withMaxLogLines(current, "Starting story extraction..."));

    const result = await runStoryExtraction({
      gamePath,
      outputDir: storyOutputDir
    });

    if (!result.ok) {
      setLogs((current) =>
        withMaxLogLines(current, `ERROR: ${result.error || "Unknown error"}`)
      );
      return;
    }

    setLogs((current) =>
      withMaxLogLines(current, `Story extraction finished with exit code ${result.exitCode}`)
    );
  }

  return {
    defaults,
    status,
    running,
    logs,
    gamePath,
    imageOutputDir,
    profile,
    nameFilter,
    captureOutputDir,
    processName,
    probeScriptPath,
    capturePid,
    storyOutputDir,
    setGamePath,
    setImageOutputDir,
    setProfile,
    setNameFilter,
    setCaptureOutputDir,
    setProcessName,
    setProbeScriptPath,
    setCapturePid,
    setStoryOutputDir,
    canRunImage,
    canRunCapture,
    canRunStory,
    runImages,
    runCapture,
    runStories,
    stopRunning
  };
}

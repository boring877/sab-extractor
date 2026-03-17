const path = require("path");

const workspaceRoot = "D:\\Silverandblood\\silver-and-blood-next";
const engineRoot = path.join(workspaceRoot, "engine");
const pythonEntryPath = path.join(engineRoot, "run_cli.py");
const defaultImageOutputDir = path.join(workspaceRoot, "output", "unity_images");
const defaultCaptureOutputDir = path.join(workspaceRoot, "output", "captured");
const defaultGamePath = "C:\\Program Files (x86)\\Silver And Blood";
const defaultProcessName = "SilverAndBlood.exe";
const defaultProbeScriptPath = path.join(engineRoot, "probes", "cdata_probe.js");
const defaultStoryOutputDir = path.join(workspaceRoot, "output", "stories");

module.exports = {
  workspaceRoot,
  engineRoot,
  pythonEntryPath,
  defaultImageOutputDir,
  defaultCaptureOutputDir,
  defaultGamePath,
  defaultProcessName,
  defaultProbeScriptPath,
  defaultStoryOutputDir
};

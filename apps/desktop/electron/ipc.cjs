const { dialog, ipcMain } = require("electron");
const {
  workspaceRoot,
  pythonEntryPath,
  defaultImageOutputDir,
  defaultCaptureOutputDir,
  defaultGamePath,
  defaultProcessName,
  defaultProbeScriptPath,
  defaultStoryOutputDir
} = require("./constants.cjs");
const { runImageExtraction, runCDataCapture, runStoryExtraction, stopRunningProcess } = require("./pythonBridge.cjs");

function registerIpcHandlers(mainWindow) {
  ipcMain.handle("dialog:pick-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:pick-file", async (_event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: Array.isArray(options?.filters) ? options.filters : undefined
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle("app:get-defaults", async () => {
    return {
      workspaceRoot,
      pythonEntryPath,
      defaultImageOutputDir,
      defaultCaptureOutputDir,
      defaultGamePath,
      defaultProcessName,
      defaultProbeScriptPath,
      defaultStoryOutputDir
    };
  });

  ipcMain.handle("extract:run-image-extraction", async (_event, options) => {
    const gamePath = String(options?.gamePath || "").trim();
    const outputDir = String(options?.outputDir || "").trim();
    const profile = String(options?.profile || "core").trim() || "core";
    const nameFilters = Array.isArray(options?.nameFilters) ? options.nameFilters : [];

    if (!gamePath) {
      return { ok: false, error: "Game path is required." };
    }
    if (!outputDir) {
      return { ok: false, error: "Output directory is required." };
    }

    return runImageExtraction(
      {
        gamePath,
        outputDir,
        profile,
        nameFilters
      },
      {
        onLog: (line) => mainWindow.webContents.send("extract:log", line),
        onState: (state) => mainWindow.webContents.send("extract:state", state)
      }
    );
  });

  ipcMain.handle("capture:run-cdata", async (_event, options) => {
    const outputDir = String(options?.outputDir || "").trim();
    const processName = String(options?.processName || defaultProcessName).trim();
    const probeScript = String(options?.probeScript || defaultProbeScriptPath).trim();
    const durationSeconds = Number.parseInt(String(options?.durationSeconds ?? ""), 10);
    const pid = Number.parseInt(String(options?.pid ?? ""), 10);

    if (!outputDir) {
      return { ok: false, error: "Output directory is required." };
    }

    return runCDataCapture(
      {
        outputDir,
        processName,
        probeScript,
        pid: Number.isFinite(pid) ? pid : undefined,
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined
      },
      {
        onLog: (line) => mainWindow.webContents.send("extract:log", line),
        onState: (state) => mainWindow.webContents.send("extract:state", state)
      }
    );
  });
  ipcMain.handle("process:stop", async () => {
    return stopRunningProcess();
  });

  ipcMain.handle("extract:run-stories", async (_event, options) => {
    const gamePath = String(options?.gamePath || "").trim();
    const outputDir = String(options?.outputDir || "").trim();

    if (!gamePath) {
      return { ok: false, error: "Game path is required." };
    }
    if (!outputDir) {
      return { ok: false, error: "Output directory is required." };
    }

    return runStoryExtraction(
      { gamePath, outputDir },
      {
        onLog: (line) => mainWindow.webContents.send("extract:log", line),
        onState: (state) => mainWindow.webContents.send("extract:state", state)
      }
    );
  });
}

module.exports = {
  registerIpcHandlers
};

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sabDesktopApi", {
  pickFolder: () => ipcRenderer.invoke("dialog:pick-folder"),
  pickFile: (options) => ipcRenderer.invoke("dialog:pick-file", options),
  getDefaults: () => ipcRenderer.invoke("app:get-defaults"),
  runImageExtraction: (options) => ipcRenderer.invoke("extract:run-image-extraction", options),
  runCDataCapture: (options) => ipcRenderer.invoke("capture:run-cdata", options),
  runStoryExtraction: (options) => ipcRenderer.invoke("extract:run-stories", options),
  stopProcess: () => ipcRenderer.invoke("process:stop"),
  onExtractionLog: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("extract:log", listener);
    return () => ipcRenderer.removeListener("extract:log", listener);
  },
  onExtractionState: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("extract:state", listener);
    return () => ipcRenderer.removeListener("extract:state", listener);
  }
});

const { BrowserWindow } = require("electron");
const path = require("path");

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1220,
    height: 900,
    minWidth: 1000,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  return window;
}

module.exports = {
  createMainWindow
};

const { app, BrowserWindow } = require("electron");
const { createMainWindow } = require("./window.cjs");
const { registerIpcHandlers } = require("./ipc.cjs");

let mainWindow = null;

app.whenReady().then(() => {
  mainWindow = createMainWindow();
  registerIpcHandlers(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      registerIpcHandlers(mainWindow);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

export function getBridge() {
  return window.sabDesktopApi || null;
}

export async function getDefaults() {
  const bridge = getBridge();
  if (!bridge) return null;
  return bridge.getDefaults();
}

export async function pickFolder() {
  const bridge = getBridge();
  if (!bridge) return null;
  return bridge.pickFolder();
}

export async function pickFile(options) {
  const bridge = getBridge();
  if (!bridge) return null;
  return bridge.pickFile(options);
}

export async function runImageExtraction(payload) {
  const bridge = getBridge();
  if (!bridge) {
    return { ok: false, error: "Desktop bridge unavailable." };
  }
  return bridge.runImageExtraction(payload);
}

export async function runCDataCapture(payload) {
  const bridge = getBridge();
  if (!bridge) {
    return { ok: false, error: "Desktop bridge unavailable." };
  }
  return bridge.runCDataCapture(payload);
}

export async function runStoryExtraction(payload) {
  const bridge = getBridge();
  if (!bridge) {
    return { ok: false, error: "Desktop bridge unavailable." };
  }
  return bridge.runStoryExtraction(payload);
}

export async function stopProcess() {
  const bridge = getBridge();
  if (!bridge) {
    return { ok: false, error: "Desktop bridge unavailable." };
  }
  return bridge.stopProcess();
}

export function subscribeExtractionLogs(handler) {
  const bridge = getBridge();
  if (!bridge) return () => {};
  return bridge.onExtractionLog(handler);
}

export function subscribeExtractionState(handler) {
  const bridge = getBridge();
  if (!bridge) return () => {};
  return bridge.onExtractionState(handler);
}

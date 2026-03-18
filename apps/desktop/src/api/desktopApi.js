import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";

export async function getDefaults() {
  return invoke("app_get_defaults");
}

export async function pickFolder() {
  const result = await open({ directory: true, multiple: false });
  return result || null;
}

export async function pickFile(options) {
  const result = await open({
    multiple: false,
    filters: Array.isArray(options?.filters) ? options.filters : undefined,
  });
  return result || null;
}

export async function runImageExtraction(payload) {
  return invoke("extract_run_image_extraction", { options: payload });
}

export async function runCDataCapture(payload) {
  return invoke("capture_run_cdata", { options: payload });
}

export async function runStoryExtraction(payload) {
  return invoke("extract_run_stories", { options: payload });
}

export async function stopProcess() {
  return invoke("process_stop");
}

export function subscribeExtractionLogs(handler) {
  return listen("extract:log", (event) => handler(event.payload));
}

export function subscribeExtractionState(handler) {
  return listen("extract:state", (event) => handler(event.payload));
}

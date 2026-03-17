const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  engineRoot,
  pythonEntryPath
} = require("./constants.cjs");

let activeChild = null;

function buildImageArgs(options) {
  const args = [
    pythonEntryPath,
    "extract-images",
    "--game-path",
    String(options.gamePath).trim(),
    "--output-dir",
    String(options.outputDir).trim(),
    "--profile",
    String(options.profile || "core").trim()
  ];

  const filters = Array.isArray(options.nameFilters) ? options.nameFilters : [];
  for (const filter of filters) {
    if (typeof filter === "string" && filter.trim()) {
      args.push("--name-contains", filter.trim());
    }
  }

  return args;
}

function buildCaptureArgs(options) {
  const args = [
    pythonEntryPath,
    "capture-cdata",
    "--output-dir",
    String(options.outputDir).trim()
  ];

  const probeScript = String(options.probeScript || "").trim();
  if (probeScript) {
    args.push("--probe-script", probeScript);
  }

  const processName = String(options.processName || "").trim();
  if (processName) {
    args.push("--process-name", processName);
  }

  if (Number.isInteger(options.pid) && options.pid > 0) {
    args.push("--pid", String(options.pid));
  }

  return args;
}

function runEngineCommand(args, hooks, runningLabel) {
  const pythonExe = process.env.PYTHON_EXE || "python";
  const fullArgs = ["-u", ...args];
  hooks.onLog(`$ ${pythonExe} ${fullArgs.join(" ")}`);
  hooks.onState({ running: true, status: runningLabel });

  return new Promise((resolve) => {
    const child = spawn(pythonExe, fullArgs, {
      cwd: engineRoot,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1"
      }
    });

    activeChild = child;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf-8");
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) hooks.onLog(line);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString("utf-8");
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) hooks.onLog(`ERR: ${line}`);
      }
    });

    child.on("error", (error) => {
      activeChild = null;
      hooks.onState({ running: false, status: "Idle" });
      resolve({ ok: false, error: String(error) });
    });

    child.on("close", (exitCode) => {
      activeChild = null;
      hooks.onState({ running: false, status: "Idle" });
      resolve({ ok: true, exitCode: exitCode ?? 1 });
    });
  });
}

function stopRunningProcess() {
  if (!activeChild) {
    return { ok: false, error: "No process running." };
  }
  const child = activeChild;
  activeChild = null;
  try {
    const outputDir = child.spawnargs
      ? findOutputDir(child.spawnargs)
      : null;
    if (outputDir) {
      const signalFile = path.join(outputDir, `.capture-stop-${child.pid}`);
      fs.writeFileSync(signalFile, "");
    } else {
      child.kill("SIGTERM");
    }
  } catch (_) {
    try { child.kill("SIGTERM"); } catch (_2) {}
  }
  return { ok: true };
}

function findOutputDir(args) {
  const idx = args.indexOf("--output-dir");
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

function runImageExtraction(options, hooks) {
  return runEngineCommand(
    buildImageArgs(options),
    hooks,
    "Running image extraction..."
  );
}

function runCDataCapture(options, hooks) {
  return runEngineCommand(
    buildCaptureArgs(options),
    hooks,
    "Running CData capture..."
  );
}

function buildStoryArgs(options) {
  const args = [
    pythonEntryPath,
    "extract-stories",
    "--game-path",
    String(options.gamePath).trim(),
    "--output-dir",
    String(options.outputDir).trim()
  ];
  return args;
}

function runStoryExtraction(options, hooks) {
  return runEngineCommand(
    buildStoryArgs(options),
    hooks,
    "Running story extraction..."
  );
}

module.exports = {
  runImageExtraction,
  runCDataCapture,
  runStoryExtraction,
  stopRunningProcess
};

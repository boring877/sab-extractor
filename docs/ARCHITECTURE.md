# Architecture Notes

## Design goals

- Separate concerns by layer and runtime boundary.
- Keep UI orchestration separate from extraction engine internals.
- Preserve extensibility for future Frida/CData pipelines.

## Engine boundaries

- `domain`: immutable request/result models.
- `infrastructure.unity`: UnityPy-specific runtime and bundle extraction.
- `infrastructure.frida`: Frida runtime, PID discovery, monitor message collector.
- `infrastructure.persistence`: captured CData file and summary writers.
- `application`: use-case orchestration, manifest writing, run totals.
- `interfaces.cli`: parsing and command surface.

## Desktop boundaries

- `electron/constants.cjs`: environment and path defaults.
- `electron/pythonBridge.cjs`: child-process bridge only.
- `electron/ipc.cjs`: IPC handlers only.
- `electron/window.cjs`: BrowserWindow creation only.
- `src/hooks`: renderer state/workflow logic.
- `src/components`: presentational form/log components.
- `src/api`: bridge adapter wrappers.

## Extension plan

1. Add engine use-case: `build-normalized-data` (captured -> normalized JSON).
2. Add desktop tabs: `Coverage` and `Runs`.
3. Add schema probe and capture coverage diff command.

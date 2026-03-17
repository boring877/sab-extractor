# Silver and Blood Next (Clean Rewrite)

This is a clean-room workspace for rebuilding extraction with strict separation of concerns.

## Why this folder exists

- Keep legacy code untouched in `silver-and-blood-extractor/`
- Build a new architecture in isolation
- Make structure easy to inspect in Cursor

## Workspace Layout

- `engine/`: modular Python backend
  - `domain/`: data contracts
  - `infrastructure/`: Unity and file IO adapters
  - `application/`: use-case orchestration
  - `interfaces/`: CLI adapter
- `apps/desktop/`: Electron + React desktop app
  - `electron/`: main-process modules
  - `src/`: renderer components/hooks/api
- `docs/`: architecture and workflow notes

## Quick Start

1. Install UnityPy in your Python environment:

```powershell
pip install UnityPy
```

2. Run extraction from CLI:

```powershell
python engine/run_cli.py extract-images --game-path "C:\Program Files (x86)\Silver And Blood"
python engine/run_cli.py capture-cdata --duration-seconds 120
python engine/run_cli.py capture-cdata --pid 505748 --duration-seconds 120
```

If `capture-cdata` reports attach timeout/error, run the terminal (or desktop app launcher terminal) as **Administrator** when the game is elevated.
When duplicate/fake game processes exist, capture now auto-ranks candidates by **highest memory first** (with window/launcher-child as tie-breakers).

3. Run desktop app:

```powershell
cd apps/desktop
npm install
npm run dev
```

## Current Scope

- Implemented: Unity bundle image extraction with manifest output.
- Implemented: Frida live CData capture (`capture-cdata`) using monitor probe.
- Next: CData transformation/normalization pipeline and coverage analytics.

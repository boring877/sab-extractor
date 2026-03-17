# SAB Engine

This package is the extraction backend for the new desktop app.

## Structure

- `domain/`: pure data models
- `infrastructure/`: UnityPy runtime + bundle IO details
- `application/`: orchestration use-cases
- `interfaces/`: CLI and host-facing entrypoints

## Run (without install)

```powershell
python engine/run_cli.py extract-images --game-path "C:\Program Files (x86)\Silver And Blood"
python engine/run_cli.py capture-cdata --duration-seconds 120
```

## Optional dependency

```powershell
pip install UnityPy
pip install frida frida-tools
```

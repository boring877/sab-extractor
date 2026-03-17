# SAB Next Desktop

Desktop app for running engine use-cases with live logs.

## Run

```powershell
cd apps/desktop
npm install
npm run dev
```

## Python launcher

- Defaults to `python`.
- Override with `PYTHON_EXE` if needed:

```powershell
$env:PYTHON_EXE = "py"
npm run dev
```

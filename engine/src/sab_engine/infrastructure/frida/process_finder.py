from __future__ import annotations

import csv
import io
import json
import subprocess
from dataclasses import dataclass


@dataclass(frozen=True)
class ProcessCandidate:
    pid: int
    parent_pid: int
    memory_bytes: int
    is_launcher_child: bool
    has_visible_window: bool


def _tasklist_visible_window_pids(process_name: str) -> set[int]:
    result = subprocess.run(
        ["tasklist", "/FI", f"IMAGENAME eq {process_name}", "/FO", "CSV", "/V"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return set()

    reader = csv.DictReader(io.StringIO(result.stdout))
    visible_pids: set[int] = set()
    for row in reader:
        try:
            pid = int(row.get("PID", "0"))
        except ValueError:
            continue
        title = (row.get("Window Title") or "").strip()
        if title and title.upper() != "N/A":
            visible_pids.add(pid)
    return visible_pids


def _cim_process_rows(process_name: str) -> list[dict]:
    launcher = "novalauncher.exe"
    command = (
        "Get-CimInstance Win32_Process | "
        f"Where-Object {{ $_.Name -in @('{process_name}','{launcher}') }} | "
        "Select-Object Name,ProcessId,ParentProcessId,WorkingSetSize | ConvertTo-Json -Compress"
    )
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", command],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return []

    rows = json.loads(result.stdout)
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list):
        return []
    return rows


def list_game_pid_candidates(process_name: str = "SilverAndBlood.exe") -> list[ProcessCandidate]:
    process_name_lower = process_name.lower()
    launcher_name = "novalauncher.exe"

    visible_window_pids: set[int]
    try:
        visible_window_pids = _tasklist_visible_window_pids(process_name=process_name)
    except Exception:
        visible_window_pids = set()

    rows = _cim_process_rows(process_name=process_name)
    if not rows:
        return []

    launcher_pids = {
        int(item.get("ProcessId") or 0)
        for item in rows
        if str(item.get("Name", "")).lower() == launcher_name
    }

    candidates: list[ProcessCandidate] = []
    for item in rows:
        if str(item.get("Name", "")).lower() != process_name_lower:
            continue

        try:
            pid = int(item.get("ProcessId") or 0)
            parent_pid = int(item.get("ParentProcessId") or 0)
            memory_bytes = int(item.get("WorkingSetSize") or 0)
        except ValueError:
            continue
        if pid <= 0:
            continue

        candidates.append(
            ProcessCandidate(
                pid=pid,
                parent_pid=parent_pid,
                memory_bytes=memory_bytes,
                is_launcher_child=parent_pid in launcher_pids,
                has_visible_window=pid in visible_window_pids,
            )
        )

    # Primary rule: choose the highest-memory process first.
    # Visible window / launcher-child are tie-breakers only.
    candidates.sort(
        key=lambda item: (
            item.memory_bytes,
            1 if item.has_visible_window else 0,
            1 if item.is_launcher_child else 0,
            item.pid,
        ),
        reverse=True,
    )
    return candidates


def find_game_pid(process_name: str = "SilverAndBlood.exe") -> int | None:
    candidates = list_game_pid_candidates(process_name=process_name)
    return candidates[0].pid if candidates else None

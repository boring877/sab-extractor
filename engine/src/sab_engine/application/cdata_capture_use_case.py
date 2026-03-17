from __future__ import annotations

import ctypes
import os
import signal
import sys
import threading
import time
from pathlib import Path
from typing import Callable

from sab_engine.application.build_catalog_use_case import build_catalog
from sab_engine.domain.models import CDataCaptureRequest, CDataCaptureSummary
from sab_engine.infrastructure.frida.monitor_collector import MonitorCollector
from sab_engine.infrastructure.frida.process_finder import (
    ProcessCandidate,
    list_game_pid_candidates,
)
from sab_engine.infrastructure.frida.runtime import FridaRuntime
from sab_engine.infrastructure.persistence.cdata_capture_writer import (
    write_capture_files,
)

LogFn = Callable[[str], None]


def _is_running_as_admin() -> bool:
    try:
        return bool(ctypes.windll.shell32.IsUserAnAdmin())  # type: ignore[attr-defined]
    except Exception:
        return False


def _format_candidate(candidate: ProcessCandidate) -> str:
    mem_mb = candidate.memory_bytes / (1024 * 1024)
    return (
        f"pid={candidate.pid} mem={mem_mb:.1f}MB "
        f"window={'yes' if candidate.has_visible_window else 'no'} "
        f"launcherChild={'yes' if candidate.is_launcher_child else 'no'}"
    )


class CDataCaptureUseCase:
    def __init__(self, runtime: FridaRuntime | None = None) -> None:
        self._runtime = runtime or FridaRuntime()

    def execute(self, request: CDataCaptureRequest, log: LogFn) -> CDataCaptureSummary:
        if not request.probe_script_path.exists():
            raise FileNotFoundError(
                f"Probe script not found: {request.probe_script_path}"
            )

        if not _is_running_as_admin():
            log(
                "Warning: tool is not running as Administrator. "
                "If the game is elevated, attach may fail."
            )

        candidates = self._resolve_candidates(request)
        if not candidates:
            raise RuntimeError(
                f"Game process not found ({request.process_name}). Start the game first."
            )

        log("Candidate game processes (best first):")
        for candidate in candidates:
            log(f"  - {_format_candidate(candidate)}")

        log(f"Probe script: {request.probe_script_path}")
        log(f"Output dir: {request.output_dir}")

        _frida = self._runtime.ensure_module()
        device = self._runtime.get_local_device()
        probe_dir = request.probe_script_path.parent
        bridge_path = probe_dir / "il2cpp_bridge.js"
        if not bridge_path.is_file():
            raise FileNotFoundError(
                f"il2cpp_bridge.js not found next to probe at {bridge_path}"
            )
        bridge_source = bridge_path.read_text(encoding="utf-8")
        probe_source = (
            bridge_source + "\n" + request.probe_script_path.read_text(encoding="utf-8")
        )
        log(
            f"Loaded bridge ({len(bridge_source)} chars) + probe ({len(probe_source) - len(bridge_source)} chars)"
        )

        selected_pid: int | None = None
        last_error: Exception | None = None
        session = None
        script = None
        collector = None
        ready_wait_seconds = 60.0

        for candidate in candidates:
            log(f"Attempting attach to PID {candidate.pid} ...")
            try:
                trial_session = self._attach_with_timeout(
                    device=device,
                    pid=candidate.pid,
                    timeout_seconds=10,
                )
                trial_collector = MonitorCollector()
                trial_script = trial_session.create_script(probe_source)
                trial_script.on(
                    "message",
                    lambda message, _data, c=trial_collector: c.handle(
                        message, log=log
                    ),
                )
                trial_script.load()

                deadline = time.time() + ready_wait_seconds
                while time.time() < deadline and not trial_collector.ready_messages:
                    time.sleep(0.1)

                if not trial_collector.ready_messages:
                    try:
                        trial_script.unload()
                    except Exception:
                        pass
                    try:
                        trial_session.detach()
                    except Exception:
                        pass
                    raise RuntimeError(
                        "Probe did not become ready on this PID (likely dummy/launcher process)."
                    )

                session = trial_session
                script = trial_script
                collector = trial_collector
                selected_pid = candidate.pid
                break
            except Exception as exc:
                last_error = exc
                log(f"  Attach failed for PID {candidate.pid}: {exc}")

        if selected_pid is None:
            raise RuntimeError(
                f"Could not attach to any candidate process. Last error: {last_error}"
            )

        log(f"Attached to PID {selected_pid}. Monitoring live CData loads...")
        if request.duration_seconds is None:
            log("Press Ctrl+C to stop and save.")
        else:
            log(f"Auto-stop after {request.duration_seconds} seconds.")

        started_at = time.time()
        next_progress_log_at = started_at + 5

        _shutdown_requested = False
        _stop_signal_path = request.output_dir / f".capture-stop-{os.getpid()}"

        def _on_sigterm(signum, frame):
            nonlocal _shutdown_requested
            _shutdown_requested = True

        try:
            signal.signal(signal.SIGTERM, _on_sigterm)
        except (OSError, ValueError):
            pass

        def _check_stop_signal():
            if _stop_signal_path.exists():
                _stop_signal_path.unlink(missing_ok=True)
                return True
            return False

        try:
            while True:
                time.sleep(0.5)
                now = time.time()
                if now >= next_progress_log_at and collector is not None:
                    log(
                        "Progress: "
                        f"classes={collector.total_classes()} "
                        f"entries={collector.total_entries()} "
                        f"loadEvents={len(collector.load_events)} "
                        f"warnings={len(collector.warnings)}"
                    )
                    next_progress_log_at = now + 5
                if (
                    request.duration_seconds is not None
                    and now - started_at >= request.duration_seconds
                ):
                    break
                if _shutdown_requested:
                    log("SIGTERM received. Saving...")
                    break
                if _check_stop_signal():
                    log("Save requested. Saving...")
                    break
        except KeyboardInterrupt:
            log("Capture interrupted by user. Saving...")
        finally:
            if script is not None:
                script.unload()
            if collector is not None:
                prev_total = collector.total_entries()
                drain_deadline = time.time() + 2.5
                while time.time() < drain_deadline:
                    time.sleep(0.3)
                    cur_total = collector.total_entries()
                    if cur_total == prev_total:
                        break
                    prev_total = cur_total
            try:
                if session is not None:
                    session.detach()
            except Exception:
                pass

        if collector is None:
            raise RuntimeError("Internal error: collector missing after attach")

        log(
            "Final in-memory capture: "
            f"classes={collector.total_classes()} "
            f"entries={collector.total_entries()} "
            f"loadEvents={len(collector.load_events)} "
            f"warnings={len(collector.warnings)}"
        )

        if collector.captures:
            sorted_classes = sorted(
                collector.captures.items(),
                key=lambda item: len(item[1]),
                reverse=True,
            )
            log("Top captured classes:")
            for class_name, rows in sorted_classes[:10]:
                log(f"  - {class_name}: {len(rows)} entries")

        summary = write_capture_files(
            captures=collector.captures,
            output_dir=request.output_dir,
            pid=selected_pid,
            capture_method="monitor_all_v2",
            load_events=collector.load_events,
            warnings=collector.warnings,
        )

        log("Building categorized catalog...")
        catalog = build_catalog(request.output_dir, log=log)
        log(
            f"Catalog: {catalog.total_classes} classes, "
            f"{catalog.total_entries} entries, "
            f"{catalog.total_categories} categories -> {catalog.catalog_path}"
        )

        return summary

    def _resolve_candidates(
        self, request: CDataCaptureRequest
    ) -> list[ProcessCandidate]:
        if request.pid is not None:
            return [
                ProcessCandidate(
                    pid=request.pid,
                    parent_pid=0,
                    memory_bytes=0,
                    is_launcher_child=False,
                    has_visible_window=False,
                )
            ]
        return list_game_pid_candidates(process_name=request.process_name)

    def _attach_with_timeout(self, device, pid: int, timeout_seconds: int):
        result: dict[str, object] = {}

        def attach_worker() -> None:
            try:
                result["session"] = device.attach(pid)
            except Exception as exc:
                result["error"] = exc

        thread = threading.Thread(target=attach_worker, daemon=True)
        thread.start()
        thread.join(timeout_seconds)

        if thread.is_alive():
            raise RuntimeError(
                "Timed out attaching. Run as Administrator when game is elevated."
            )

        error = result.get("error")
        if error is not None:
            raise RuntimeError(str(error))

        session = result.get("session")
        if session is None:
            raise RuntimeError("attach failed with unknown error")
        return session

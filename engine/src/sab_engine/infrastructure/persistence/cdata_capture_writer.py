from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from sab_engine.domain.models import CDataCaptureSummary, CDataClassCaptureFile


def write_capture_files(
    captures: dict[str, dict[str, dict]],
    output_dir: Path,
    pid: int,
    capture_method: str,
    load_events: set[str],
    warnings: list[str],
) -> CDataCaptureSummary:
    output_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now()
    timestamp_tag = now.strftime("%Y%m%d_%H%M%S")
    iso_timestamp = now.isoformat()

    total_entries = 0
    class_files: list[CDataClassCaptureFile] = []

    for class_name in sorted(captures.keys()):
        rows = captures[class_name]
        total_entries += len(rows)
        file_path = output_dir / f"{class_name}_{timestamp_tag}.json"
        payload = {
            "className": class_name,
            "timestamp": iso_timestamp,
            "captureMethod": capture_method,
            "pid": pid,
            "totalEntries": len(rows),
            "data": rows,
        }
        with file_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
        class_files.append(
            CDataClassCaptureFile(
                class_name=class_name,
                path=file_path.resolve(),
                entries=len(rows),
            )
        )

    summary_path = output_dir / f"summary_{timestamp_tag}.json"
    summary_payload = {
        "timestamp": iso_timestamp,
        "captureMethod": capture_method,
        "pid": pid,
        "classes": {item.class_name: item.entries for item in class_files},
        "totalClasses": len(class_files),
        "totalEntries": total_entries,
        "loadEvents": sorted(load_events),
        "warningCount": len(warnings),
    }
    with summary_path.open("w", encoding="utf-8") as handle:
        json.dump(summary_payload, handle, indent=2, ensure_ascii=False)

    return CDataCaptureSummary(
        pid=pid,
        output_dir=output_dir.resolve(),
        summary_path=summary_path.resolve(),
        total_classes=len(class_files),
        total_entries=total_entries,
        class_files=tuple(class_files),
        load_event_count=len(load_events),
        warning_count=len(warnings),
    )

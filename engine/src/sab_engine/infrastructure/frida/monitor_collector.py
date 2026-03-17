from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

LogFn = Callable[[str], None]


@dataclass
class MonitorCollector:
    captures: dict[str, dict[str, dict]] = field(default_factory=dict)
    load_events: set[str] = field(default_factory=set)
    warnings: list[str] = field(default_factory=list)
    ready_messages: list[dict] = field(default_factory=list)

    def total_classes(self) -> int:
        return len(self.captures)

    def total_entries(self) -> int:
        return sum(len(items) for items in self.captures.values())

    def handle(self, message: dict, log: LogFn) -> None:
        message_type = message.get("type")
        if message_type == "send":
            self._handle_payload(message.get("payload") or {}, log=log)
            return

        if message_type == "error":
            description = message.get("description", "Unknown script error")
            log(f"Frida script error: {description}")
            stack = message.get("stack")
            if stack:
                log(stack)

    def _handle_payload(self, payload: dict, log: LogFn) -> None:
        payload_type = payload.get("type")
        if payload_type == "monitor_ready":
            self.ready_messages.append(payload)
            hooked_parse = payload.get("hookedParseMethods")
            hooked_load = payload.get("hookedLoadMethods")
            hooked_init = payload.get("hookedInitMethods")
            registered = payload.get("registeredInstances")
            log(
                f"Monitor ready. ParseHooks={hooked_parse} LoadHooks={hooked_load} InitHooks={hooked_init} RegisteredInstances={registered}"
            )
            return

        if payload_type == "load_event":
            class_name = str(payload.get("className") or "unknown")
            method_name = str(payload.get("methodName") or "unknown")
            event_key = f"{class_name}:{method_name}"
            if event_key not in self.load_events:
                self.load_events.add(event_key)
                log(f"Loaded: {class_name} via {method_name}")
            return

        if payload_type == "captured_batch":
            class_name = str(payload.get("className") or "unknown")
            data_by_key = payload.get("data") or {}
            if not isinstance(data_by_key, dict):
                data_by_key = {}

            class_map = self.captures.setdefault(class_name, {})
            existing_keys = set(class_map.keys())
            incoming_keys = list(data_by_key.keys())
            new_keys = [key for key in incoming_keys if key not in existing_keys]
            updated_count = len(incoming_keys) - len(new_keys)

            class_map.update(data_by_key)
            after_count = len(class_map)
            added_count = len(new_keys)

            chunk_index = payload.get("chunkIndex")
            chunk_count = payload.get("chunkCount")
            added_preview = ""
            if new_keys:
                preview_keys = [str(item) for item in new_keys[:5]]
                more = f" (+{len(new_keys) - 5} more)" if len(new_keys) > 5 else ""
                added_preview = f" keys={', '.join(preview_keys)}{more}"

            log(
                f"Added: {class_name} +{added_count} new, {updated_count} updated "
                f"(chunk {chunk_index}/{chunk_count}, classTotal={after_count}, globalTotal={self.total_entries()})"
                f"{added_preview}"
            )
            return

        if payload_type == "monitor_warning":
            class_name = payload.get("className")
            method_name = payload.get("methodName")
            warning = payload.get("message")
            line = f"Warning: {class_name}.{method_name} -> {warning}"
            self.warnings.append(line)
            log(line)
            return

        if payload_type == "scan_progress":
            phase = payload.get("phase")
            total_classes = payload.get("totalClasses")
            loaded_classes = payload.get("loadedClasses")
            added_rows = payload.get("addedRows")
            log(
                f"Instance scan ({phase}): loadedClasses={loaded_classes}/{total_classes}, "
                f"newRows={added_rows}, globalTotal={self.total_entries()}"
            )

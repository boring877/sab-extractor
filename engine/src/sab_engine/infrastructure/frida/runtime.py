from __future__ import annotations

from types import ModuleType


class FridaRuntimeError(RuntimeError):
    pass


class FridaRuntime:
    def __init__(self) -> None:
        self._module: ModuleType | None = None

    def ensure_module(self) -> ModuleType:
        if self._module is not None:
            return self._module

        try:
            import frida  # type: ignore
        except ImportError as exc:
            raise FridaRuntimeError(
                "Frida Python package is required. Install with: pip install frida frida-tools"
            ) from exc

        self._module = frida
        return self._module

    def get_local_device(self):
        module = self.ensure_module()
        return module.get_local_device()

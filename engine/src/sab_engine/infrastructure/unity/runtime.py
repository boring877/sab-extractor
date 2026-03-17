from __future__ import annotations

from types import ModuleType


class UnityRuntimeError(RuntimeError):
    pass


class UnityRuntime:
    def __init__(self) -> None:
        self._module: ModuleType | None = None

    def ensure_module(self) -> ModuleType:
        if self._module is not None:
            return self._module

        try:
            import UnityPy  # type: ignore
        except ImportError as exc:
            raise UnityRuntimeError(
                "UnityPy is required. Install it with: pip install UnityPy"
            ) from exc

        self._module = UnityPy
        return self._module

    def load_environment(self, bundle_bytes: bytes):
        module = self.ensure_module()
        return module.load(bundle_bytes)

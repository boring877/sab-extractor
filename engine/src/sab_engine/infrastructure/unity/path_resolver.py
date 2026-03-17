from __future__ import annotations

from pathlib import Path

from sab_engine.infrastructure.unity.constants import CORE_BUNDLES


def resolve_game_data_dir(game_path: Path) -> Path:
    if game_path.name.lower() == "silverandblood_data":
        return game_path

    candidates = (
        game_path / "SilverAndBlood" / "SilverAndBlood_Data",
        game_path / "SilverAndBlood_Data",
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate

    raise FileNotFoundError(
        f"Could not find SilverAndBlood_Data under: {game_path}"
    )


def list_ui_directories(game_data_dir: Path) -> tuple[Path, ...]:
    candidates = (
        game_data_dir / "dragon2019" / "assets" / "UI",
        game_data_dir / "StreamingAssets" / "UI",
    )
    return tuple(path for path in candidates if path.exists())


def collect_bundle_paths(game_data_dir: Path, profile: str) -> tuple[Path, ...]:
    ui_dirs = list_ui_directories(game_data_dir)
    if not ui_dirs:
        return ()

    paths: list[Path] = []
    seen: set[str] = set()

    if profile == "core":
        for ui_dir in ui_dirs:
            for bundle_name in CORE_BUNDLES:
                candidate = ui_dir / bundle_name
                if candidate.exists():
                    key = str(candidate.resolve())
                    if key not in seen:
                        seen.add(key)
                        paths.append(candidate)
        return tuple(paths)

    for ui_dir in ui_dirs:
        for candidate in sorted(ui_dir.glob("*.unity3d")):
            key = str(candidate.resolve())
            if key not in seen:
                seen.add(key)
                paths.append(candidate)
    return tuple(paths)

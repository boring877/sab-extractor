from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from sab_engine.domain.models import AssetRecord, BundleExtractionStats
from sab_engine.infrastructure.unity.runtime import UnityRuntime


UNITY_SIGNATURES = (b"UnityFS", b"UnityWeb", b"UnityRaw")


@dataclass(frozen=True)
class BundleExtractionOutput:
    stats: BundleExtractionStats
    assets: tuple[AssetRecord, ...]


def find_unity_offset(bundle_data: bytes) -> int:
    for signature in UNITY_SIGNATURES:
        index = bundle_data.find(signature)
        if index != -1:
            return index
    return -1


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^\w\-. ]+", "_", value.strip())
    cleaned = cleaned.strip(" .")
    return cleaned or "unnamed"


def ensure_unique_path(directory: Path, filename: str) -> Path:
    candidate = directory / filename
    if not candidate.exists():
        return candidate

    stem = candidate.stem
    suffix = candidate.suffix
    counter = 2
    while True:
        next_candidate = directory / f"{stem}_{counter}{suffix}"
        if not next_candidate.exists():
            return next_candidate
        counter += 1


class UnityBundleExtractor:
    def __init__(self, runtime: UnityRuntime) -> None:
        self.runtime = runtime

    def extract_bundle(
        self,
        bundle_path: Path,
        output_dir: Path,
        name_filters: tuple[str, ...],
    ) -> BundleExtractionOutput:
        with bundle_path.open("rb") as handle:
            raw = handle.read()

        offset = find_unity_offset(raw)
        if offset == -1:
            raise RuntimeError(f"Unity signature not found in bundle: {bundle_path.name}")

        env = self.runtime.load_environment(raw[offset:])
        target_dir = output_dir / sanitize_filename(bundle_path.stem)
        target_dir.mkdir(parents=True, exist_ok=True)

        saved = 0
        skipped = 0
        errors = 0
        assets: list[AssetRecord] = []
        filters_lower = tuple(item.lower() for item in name_filters if item.strip())

        for obj in env.objects:
            if obj.type.name not in ("Sprite", "Texture2D"):
                continue
            try:
                asset = obj.read()
                asset_name = (
                    getattr(asset, "m_Name", None)
                    or getattr(asset, "name", None)
                    or f"{obj.type.name}_{obj.path_id}"
                )
                asset_name = str(asset_name)
                if filters_lower and not any(token in asset_name.lower() for token in filters_lower):
                    skipped += 1
                    continue

                image = getattr(asset, "image", None)
                if image is None:
                    skipped += 1
                    continue

                filename = sanitize_filename(asset_name) + ".png"
                output_path = ensure_unique_path(target_dir, filename)
                image.save(str(output_path))
                saved += 1

                assets.append(
                    AssetRecord(
                        bundle_name=bundle_path.name,
                        bundle_path=bundle_path.resolve(),
                        asset_name=asset_name,
                        object_type=obj.type.name,
                        output_path=output_path.resolve(),
                        width=image.width,
                        height=image.height,
                    )
                )
            except Exception:
                errors += 1

        return BundleExtractionOutput(
            stats=BundleExtractionStats(
                bundle_name=bundle_path.name,
                bundle_path=bundle_path.resolve(),
                saved=saved,
                skipped=skipped,
                errors=errors,
            ),
            assets=tuple(assets),
        )

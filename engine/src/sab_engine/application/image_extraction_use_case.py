from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from sab_engine.domain.models import ImageExtractionRequest, ImageExtractionSummary
from sab_engine.infrastructure.unity.bundle_extractor import UnityBundleExtractor
from sab_engine.infrastructure.unity.path_resolver import collect_bundle_paths, resolve_game_data_dir
from sab_engine.infrastructure.unity.runtime import UnityRuntime, UnityRuntimeError

LogFn = Callable[[str], None]


class ImageExtractionUseCase:
    def __init__(self, runtime: UnityRuntime | None = None) -> None:
        self._runtime = runtime or UnityRuntime()
        self._extractor = UnityBundleExtractor(runtime=self._runtime)

    def execute(self, request: ImageExtractionRequest, log: LogFn) -> ImageExtractionSummary:
        game_data_dir = resolve_game_data_dir(request.game_path)
        bundle_paths = collect_bundle_paths(game_data_dir=game_data_dir, profile=request.profile)
        if not bundle_paths:
            raise FileNotFoundError(
                f"No bundles found for profile '{request.profile}' in {game_data_dir}"
            )

        request.output_dir.mkdir(parents=True, exist_ok=True)

        log(f"Game data directory: {game_data_dir}")
        log(f"Output directory: {request.output_dir}")
        log(f"Profile: {request.profile}")
        log(f"Bundle count: {len(bundle_paths)}")
        if request.name_filters:
            log(f"Name filters: {list(request.name_filters)}")

        all_assets = []
        bundle_results = []
        total_saved = 0
        total_skipped = 0
        total_errors = 0

        for index, bundle_path in enumerate(bundle_paths, start=1):
            log(f"[{index}/{len(bundle_paths)}] Processing {bundle_path.name} ...")
            try:
                output = self._extractor.extract_bundle(
                    bundle_path=bundle_path,
                    output_dir=request.output_dir,
                    name_filters=request.name_filters,
                )
                bundle_results.append(output.stats)
                all_assets.extend(output.assets)
                total_saved += output.stats.saved
                total_skipped += output.stats.skipped
                total_errors += output.stats.errors
                log(
                    f"  Saved={output.stats.saved} Skipped={output.stats.skipped} Errors={output.stats.errors}"
                )
            except UnityRuntimeError as exc:
                raise RuntimeError(str(exc)) from exc
            except Exception as exc:  # keep run alive for other bundles
                total_errors += 1
                log(f"  ERROR: Failed bundle {bundle_path.name}: {exc}")

        summary = ImageExtractionSummary(
            game_data_dir=game_data_dir.resolve(),
            output_dir=request.output_dir.resolve(),
            profile=request.profile,
            filters=request.name_filters,
            bundles=tuple(bundle_results),
            assets=tuple(all_assets),
            total_saved=total_saved,
            total_skipped=total_skipped,
            total_errors=total_errors,
        )
        self._write_manifest(summary)
        return summary

    def _write_manifest(self, summary: ImageExtractionSummary) -> None:
        payload = {
            "gameDataDir": str(summary.game_data_dir),
            "outputDir": str(summary.output_dir),
            "profile": summary.profile,
            "filters": list(summary.filters),
            "bundles": [
                {
                    "bundle": item.bundle_name,
                    "bundlePath": str(item.bundle_path),
                    "saved": item.saved,
                    "skipped": item.skipped,
                    "errors": item.errors,
                }
                for item in summary.bundles
            ],
            "totals": {
                "saved": summary.total_saved,
                "skipped": summary.total_skipped,
                "errors": summary.total_errors,
            },
            "assets": [
                {
                    "bundle": asset.bundle_name,
                    "bundlePath": str(asset.bundle_path),
                    "assetName": asset.asset_name,
                    "objectType": asset.object_type,
                    "path": str(asset.output_path),
                    "width": asset.width,
                    "height": asset.height,
                }
                for asset in summary.assets
            ],
        }

        manifest_path = Path(summary.output_dir) / "manifest.json"
        with manifest_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)

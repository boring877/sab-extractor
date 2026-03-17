from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

from sab_engine.application.build_catalog_use_case import build_catalog
from sab_engine.application.cdata_capture_use_case import CDataCaptureUseCase
from sab_engine.application.image_extraction_use_case import ImageExtractionUseCase
from sab_engine.application.story_extraction_use_case import StoryExtractionUseCase
from sab_engine.domain.models import (
    CDataCaptureRequest,
    ImageExtractionRequest,
    StoryExtractionRequest,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sab-engine",
        description="Modular extraction engine CLI for Silver and Blood.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    extract = subparsers.add_parser(
        "extract-images",
        help="Extract UI images from installed game bundles using UnityPy.",
    )
    extract.add_argument(
        "--game-path",
        required=True,
        help="Path to game install root or SilverAndBlood_Data directory.",
    )
    extract.add_argument(
        "--output-dir",
        default=str(Path.cwd() / "output" / "unity_images"),
        help="Directory for extracted images and manifest.",
    )
    extract.add_argument(
        "--profile",
        choices=("core", "all-ui"),
        default="core",
        help="core: selected atlases, all-ui: all UI .unity3d bundles.",
    )
    extract.add_argument(
        "--name-contains",
        action="append",
        default=[],
        help="Optional substring filter for asset names; can be repeated.",
    )

    capture = subparsers.add_parser(
        "capture-cdata",
        help="Capture live CData from running game using Frida monitor probe.",
    )
    capture.add_argument(
        "--output-dir",
        default=str(Path.cwd() / "output" / "captured"),
        help="Directory for captured CData JSON files.",
    )
    capture.add_argument(
        "--probe-script",
        default=str(Path(__file__).resolve().parents[3] / "probes" / "cdata_probe.js"),
        help="Path to compiled Frida monitor JS.",
    )
    capture.add_argument(
        "--process-name",
        default="SilverAndBlood.exe",
        help="Target game process executable name.",
    )
    capture.add_argument(
        "--pid",
        type=int,
        default=None,
        help="Optional PID override.",
    )
    capture.add_argument(
        "--duration-seconds",
        type=int,
        default=None,
        help="Auto-stop after N seconds. If omitted, run until Ctrl+C.",
    )

    catalog = subparsers.add_parser(
        "build-catalog",
        help="Scan captured CData files and generate a categorized catalog.",
    )
    catalog.add_argument(
        "--output-dir",
        default=str(Path.cwd() / "output" / "captured"),
        help="Directory containing captured CData JSON files.",
    )

    stories = subparsers.add_parser(
        "extract-stories",
        help="Extract character stories from the game localization bundle.",
    )
    stories.add_argument(
        "--game-path",
        required=True,
        help="Path to game install root or SilverAndBlood_Data directory.",
    )
    stories.add_argument(
        "--output-dir",
        default=str(Path.cwd() / "output" / "stories"),
        help="Directory for extracted story JSON files.",
    )

    return parser


def _parse_request(args: argparse.Namespace) -> ImageExtractionRequest:
    filters = tuple(item.strip() for item in args.name_contains if item.strip())
    return ImageExtractionRequest(
        game_path=Path(args.game_path).expanduser().resolve(),
        output_dir=Path(args.output_dir).expanduser().resolve(),
        profile=args.profile,
        name_filters=filters,
    )


def _parse_capture_request(args: argparse.Namespace) -> CDataCaptureRequest:
    return CDataCaptureRequest(
        output_dir=Path(args.output_dir).expanduser().resolve(),
        probe_script_path=Path(args.probe_script).expanduser().resolve(),
        duration_seconds=args.duration_seconds,
        process_name=args.process_name,
        pid=args.pid,
    )


def main(argv: Iterable[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.command == "extract-images":
        request = _parse_request(args)
        if not request.game_path.exists():
            print(f"ERROR: game path does not exist: {request.game_path}")
            return 1

        use_case = ImageExtractionUseCase()

        try:
            summary = use_case.execute(request=request, log=print)
        except Exception as exc:
            print(f"ERROR: {exc}")
            return 1

        print("")
        print("Extraction complete.")
        print(f"Saved files: {summary.total_saved}")
        print(f"Skipped assets: {summary.total_skipped}")
        print(f"Errors: {summary.total_errors}")
        print(f"Manifest: {summary.output_dir / 'manifest.json'}")
        return 0

    if args.command == "capture-cdata":
        request = _parse_capture_request(args)
        use_case = CDataCaptureUseCase()
        try:
            summary = use_case.execute(request=request, log=print)
        except Exception as exc:
            print(f"ERROR: {exc}")
            return 1

        print("")
        print("CData capture complete.")
        print(f"Classes: {summary.total_classes}")
        print(f"Entries: {summary.total_entries}")
        print(f"Load events: {summary.load_event_count}")
        print(f"Warnings: {summary.warning_count}")
        if summary.class_files:
            print("Saved class files:")
            for class_file in summary.class_files:
                print(
                    f"  - {class_file.class_name}: {class_file.entries} entries -> {class_file.path}"
                )
        print(f"Summary: {summary.summary_path}")
        return 0

    if args.command == "build-catalog":
        output_dir = Path(args.output_dir).expanduser().resolve()
        try:
            catalog = build_catalog(output_dir, log=print)
        except Exception as exc:
            print(f"ERROR: {exc}")
            return 1

        print("")
        print("Catalog built successfully.")
        print(f"Classes: {catalog.total_classes}")
        print(f"Entries: {catalog.total_entries}")
        print(f"Categories: {catalog.total_categories}")
        print("")
        print("Categories breakdown:")
        for cat in catalog.categories:
            print(
                f"  [{cat.category} > {cat.subcategory}] {cat.class_count} classes, {cat.total_entries} entries"
            )
        print(f"")
        print(f"Catalog: {catalog.catalog_path}")
        return 0

    if args.command == "extract-stories":
        request = StoryExtractionRequest(
            game_path=Path(args.game_path).expanduser().resolve(),
            output_dir=Path(args.output_dir).expanduser().resolve(),
        )
        if not request.game_path.exists():
            print(f"ERROR: game path does not exist: {request.game_path}")
            return 1

        use_case = StoryExtractionUseCase()
        try:
            summary = use_case.execute(request=request, log=print)
        except Exception as exc:
            import traceback

            traceback.print_exc()
            print(f"ERROR: {exc}")
            return 1

        print("")
        print("Story extraction complete.")
        print(f"Total stories: {summary.total_stories}")
        print(f"Characters: {summary.total_characters}")
        print(f"Output: {summary.output_dir / 'stories'}")
        return 0

    parser.print_help()
    return 1

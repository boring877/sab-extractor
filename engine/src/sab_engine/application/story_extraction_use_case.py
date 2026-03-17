from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from sab_engine.domain.models import (
    StoryExtractionRequest,
    StoryExtractionSummary,
    StoryRecord,
)
from sab_engine.infrastructure.unity.path_resolver import resolve_game_data_dir
from sab_engine.infrastructure.unity.runtime import UnityRuntime, UnityRuntimeError
from sab_engine.infrastructure.unity.text_extractor import LocalizationTextExtractor

LogFn = Callable[[str], None]

LANGUAGE_BUNDLE = "dragon2019/assets/Document/AllLanguageEN.unity3d"


def _clean_text(text: str) -> str:
    return text.encode("utf-8", errors="surrogatepass").decode(
        "utf-8", errors="replace"
    )


def _write_json(path: Path, data) -> None:
    with path.open("w", encoding="utf-8", errors="surrogatepass") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False, default=str)


class StoryExtractionUseCase:
    def __init__(self, runtime: UnityRuntime | None = None) -> None:
        self._runtime = runtime or UnityRuntime()
        self._extractor = LocalizationTextExtractor(runtime=self._runtime)

    def execute(
        self, request: StoryExtractionRequest, log: LogFn
    ) -> StoryExtractionSummary:
        game_data_dir = resolve_game_data_dir(request.game_path)
        bundle_path = game_data_dir / LANGUAGE_BUNDLE
        if not bundle_path.exists():
            raise FileNotFoundError(f"Localization bundle not found: {bundle_path}")

        request.output_dir.mkdir(parents=True, exist_ok=True)

        log(f"Game data directory: {game_data_dir}")
        log(f"Bundle: {bundle_path}")
        log(f"Output directory: {request.output_dir}")

        log("Reading localization bundle...")
        text = self._extractor.extract_all_text(bundle_path)
        log(f"Text length: {len(text)} characters")

        log("Extracting stories...")
        raw_stories = self._extractor.extract_stories(text)
        log(f"Found {len(raw_stories)} story entries")

        arc_names: set[str] = set()
        records: list[StoryRecord] = []
        seen: set[tuple[str, str]] = set()

        for raw in raw_stories:
            key = (raw.title, raw.letter)
            if key in seen:
                continue
            seen.add(key)
            arc_names.add(raw.title)
            records.append(
                StoryRecord(
                    title=raw.title,
                    letter=raw.letter,
                    subtitle=raw.subtitle,
                    text=raw.text,
                )
            )

        log(f"Unique stories: {len(records)}")
        log(f"Story arcs found: {len(arc_names)}")

        for name in sorted(arc_names):
            count = sum(1 for r in records if r.title == name)
            log(f"  {name}: {count} chapters")

        stories_output_dir = request.output_dir / "stories"
        stories_output_dir.mkdir(parents=True, exist_ok=True)

        self._write_all_stories(records, stories_output_dir)
        log(f"Saved all stories to: {stories_output_dir / 'all_stories.json'}")

        self._write_stories_by_arc(records, stories_output_dir)
        log(f"Saved per-arc stories to: {stories_output_dir}")

        summary = StoryExtractionSummary(
            game_data_dir=game_data_dir.resolve(),
            output_dir=request.output_dir.resolve(),
            total_stories=len(records),
            total_characters=len(arc_names),
            stories=tuple(records),
        )

        self._write_manifest(summary)
        log(f"Manifest: {request.output_dir / 'story_manifest.json'}")
        return summary

    @staticmethod
    def _write_all_stories(records: list[StoryRecord], output_dir: Path) -> None:
        payload = []
        for r in records:
            payload.append(
                {
                    "title": _clean_text(r.title),
                    "letter": r.letter,
                    "subtitle": _clean_text(r.subtitle),
                    "text": _clean_text(r.text),
                }
            )
        path = output_dir / "all_stories.json"
        _write_json(path, payload)

    @staticmethod
    def _write_stories_by_arc(records: list[StoryRecord], output_dir: Path) -> None:
        by_arc: dict[str, list[dict]] = {}
        for r in records:
            by_arc.setdefault(r.title, []).append(
                {
                    "letter": r.letter,
                    "subtitle": _clean_text(r.subtitle),
                    "text": _clean_text(r.text),
                }
            )
        for arc_name, stories in by_arc.items():
            safe_name = arc_name.lower().replace(" ", "-")
            safe_name = "".join(
                c if c.isalnum() or c in "-_" else "" for c in safe_name
            )
            arc_path = output_dir / f"{safe_name}.json"
            _write_json(arc_path, stories)

    @staticmethod
    def _write_manifest(summary: StoryExtractionSummary) -> None:
        payload = {
            "gameDataDir": str(summary.game_data_dir),
            "outputDir": str(summary.output_dir),
            "totalStories": summary.total_stories,
            "storyArcs": summary.total_characters,
            "stories": [
                {
                    "title": r.title,
                    "letter": r.letter,
                    "subtitle": r.subtitle,
                }
                for r in summary.stories
            ],
        }
        path = Path(summary.output_dir) / "story_manifest.json"
        _write_json(path, payload)

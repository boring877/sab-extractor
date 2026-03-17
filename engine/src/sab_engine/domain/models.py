from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ImageExtractionRequest:
    game_path: Path
    output_dir: Path
    profile: str
    name_filters: tuple[str, ...]


@dataclass(frozen=True)
class BundleExtractionStats:
    bundle_name: str
    bundle_path: Path
    saved: int
    skipped: int
    errors: int


@dataclass(frozen=True)
class AssetRecord:
    bundle_name: str
    bundle_path: Path
    asset_name: str
    object_type: str
    output_path: Path
    width: int
    height: int


@dataclass(frozen=True)
class ImageExtractionSummary:
    game_data_dir: Path
    output_dir: Path
    profile: str
    filters: tuple[str, ...]
    bundles: tuple[BundleExtractionStats, ...]
    assets: tuple[AssetRecord, ...]
    total_saved: int
    total_skipped: int
    total_errors: int


@dataclass(frozen=True)
class CDataCaptureRequest:
    output_dir: Path
    probe_script_path: Path
    duration_seconds: int | None
    process_name: str
    pid: int | None


@dataclass(frozen=True)
class CDataClassCaptureFile:
    class_name: str
    path: Path
    entries: int


@dataclass(frozen=True)
class CDataCaptureSummary:
    pid: int
    output_dir: Path
    summary_path: Path
    total_classes: int
    total_entries: int
    class_files: tuple[CDataClassCaptureFile, ...]
    load_event_count: int
    warning_count: int


@dataclass(frozen=True)
class CatalogClassEntry:
    class_name: str
    category: str
    subcategory: str
    entries: int
    source_file: str


@dataclass(frozen=True)
class CatalogCategorySummary:
    category: str
    subcategory: str
    class_count: int
    total_entries: int
    classes: tuple[str, ...]


@dataclass(frozen=True)
class StoryExtractionRequest:
    game_path: Path
    output_dir: Path


@dataclass(frozen=True)
class StoryRecord:
    title: str
    letter: str
    subtitle: str
    text: str


@dataclass(frozen=True)
class StoryExtractionSummary:
    game_data_dir: Path
    output_dir: Path
    total_stories: int
    total_characters: int
    stories: tuple[StoryRecord, ...]


@dataclass(frozen=True)
class Catalog:
    timestamp: str
    source_dir: Path
    catalog_path: Path
    total_classes: int
    total_entries: int
    total_categories: int
    classes: tuple[CatalogClassEntry, ...]
    categories: tuple[CatalogCategorySummary, ...]

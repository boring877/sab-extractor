from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Callable

from sab_engine.domain.cdata_categories import get_category
from sab_engine.domain.models import (
    Catalog,
    CatalogCategorySummary,
    CatalogClassEntry,
)

LogFn = Callable[[str], None]


def build_catalog(output_dir: Path, log: LogFn = lambda _: None) -> Catalog:
    output_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now()
    iso_timestamp = now.isoformat()
    timestamp_tag = now.strftime("%Y%m%d_%H%M%S")

    class_entries: list[CatalogClassEntry] = []
    seen_classes: dict[str, tuple[int, str]] = {}

    json_files = sorted(output_dir.glob("CData_*.json"))
    log(f"Scanning {len(json_files)} CData files in {output_dir}")

    for file_path in json_files:
        try:
            with file_path.open("r", encoding="utf-8") as f:
                data = json.load(f)

            class_name = data.get(
                "className", file_path.stem.split("_" + timestamp_tag)[0]
            )
            total_entries = data.get("totalEntries", 0)

            if class_name in seen_classes:
                existing_count, existing_file = seen_classes[class_name]
                if total_entries >= existing_count:
                    seen_classes[class_name] = (total_entries, file_path.name)
                continue

            seen_classes[class_name] = (total_entries, file_path.name)

        except (json.JSONDecodeError, OSError) as exc:
            log(f"  Warning: skipping {file_path.name}: {exc}")
            continue

    for class_name, (entries, source_file) in sorted(seen_classes.items()):
        category, subcategory = get_category(class_name)
        class_entries.append(
            CatalogClassEntry(
                class_name=class_name,
                category=category,
                subcategory=subcategory,
                entries=entries,
                source_file=source_file,
            )
        )

    cat_map: dict[str, dict[str, list[str]]] = {}
    cat_entry_count: dict[str, dict[str, int]] = {}
    for entry in class_entries:
        cat_map.setdefault(entry.category, {}).setdefault(entry.subcategory, []).append(
            entry.class_name
        )
        cat_entry_count.setdefault(entry.category, {})[entry.subcategory] = (
            cat_entry_count.get(entry.category, {}).get(entry.subcategory, 0)
            + entry.entries
        )

    category_summaries: list[CatalogCategorySummary] = []
    for category in sorted(cat_map.keys()):
        for subcategory in sorted(cat_map[category].keys()):
            class_names = tuple(sorted(cat_map[category][subcategory]))
            category_summaries.append(
                CatalogCategorySummary(
                    category=category,
                    subcategory=subcategory,
                    class_count=len(class_names),
                    total_entries=cat_entry_count[category][subcategory],
                    classes=class_names,
                )
            )

    total_entries = sum(e.entries for e in class_entries)
    unique_categories = len(set(e.category for e in class_entries))

    log(
        f"Catalog: {len(class_entries)} classes, {total_entries} entries, {unique_categories} categories"
    )

    catalog_path = output_dir / f"catalog_{timestamp_tag}.json"
    payload = {
        "timestamp": iso_timestamp,
        "sourceDir": str(output_dir),
        "totalClasses": len(class_entries),
        "totalEntries": total_entries,
        "totalCategories": unique_categories,
        "classes": [
            {
                "className": e.class_name,
                "category": e.category,
                "subcategory": e.subcategory,
                "entries": e.entries,
                "sourceFile": e.source_file,
            }
            for e in class_entries
        ],
        "categories": [
            {
                "category": c.category,
                "subcategory": c.subcategory,
                "classCount": c.class_count,
                "totalEntries": c.total_entries,
                "classes": list(c.classes),
            }
            for c in category_summaries
        ],
    }

    with catalog_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    log(f"Catalog written to {catalog_path}")

    return Catalog(
        timestamp=iso_timestamp,
        source_dir=output_dir.resolve(),
        catalog_path=catalog_path.resolve(),
        total_classes=len(class_entries),
        total_entries=total_entries,
        total_categories=unique_categories,
        classes=tuple(class_entries),
        categories=tuple(category_summaries),
    )

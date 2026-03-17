from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from sab_engine.infrastructure.unity.runtime import UnityRuntime, UnityRuntimeError

ROMAN = ["I", "II", "III", "IV", "V", "VI"]
LETTER_PATTERN = re.compile(r"\x08Letter\s+(I{1,3}|IV|V|VI)")
JOURNAL_ARC_NAMES = [
    "Background",
    "Promise",
    "Concealment and Deception",
    "The Other Her",
    "The Heavy Shield",
    "For Whom the Shield is Raised",
    "A Dusty Past",
    "Narrator",
    "Dressing Mirror",
    "Born from Nothing",
    "Hello, Newcomer",
    "A Letter from a Stranger",
    "Where Day Meets Night",
    "Spiraling Impulse",
    "The Forged Blade",
    "The Malice Within",
    "The Colorless Past",
    "A Shared Future",
    "The Most Familiar Stranger",
    "Fireworks Beneath Distant Skies",
    "Words Left Unspoken",
    "Bound by Love and Torment",
    "'King'",
    "Strange Letter",
    "Damaged Instrument",
    "Message from the Bookseller",
    "Noah",
    "Frail Vessel",
    "New Case",
    "The Most Peculiar View",
    "The Mysterious Diary",
    "Shadowless Defender",
    "Ending",
]
STORY_TEXT_STOP = frozenset({0, 3, 4, 6, 11, 12, 13, 14, 15, 16, 19, 21})


@dataclass
class RawStory:
    title: str
    letter: str
    subtitle: str
    text: str


class LocalizationTextExtractor:
    def __init__(self, runtime: UnityRuntime | None = None) -> None:
        self._runtime = runtime or UnityRuntime()

    def extract_all_text(self, bundle_path: Path) -> str:
        module = self._runtime.ensure_module()
        raw = bundle_path.read_bytes()
        sig = b"UnityFS"
        offset = raw.find(sig)
        if offset > 0:
            raw = raw[offset:]
        elif offset == -1:
            for alt in (b"UnityWeb", b"UnityRaw"):
                offset = raw.find(alt)
                if offset >= 0:
                    raw = raw[offset:]
                    break
        env = module.load(raw)
        for obj in env.objects:
            if obj.type.name == "TextAsset":
                asset = obj.read()
                script = getattr(asset, "m_Script", None)
                if isinstance(script, str):
                    return script
        raise UnityRuntimeError("No TextAsset found in localization bundle.")

    def extract_stories(self, text: str) -> list[RawStory]:
        stories: list[RawStory] = []
        seen_keys: set[tuple[str, str]] = set()
        seen_text_starts: set[str] = set()

        for raw_story in self._extract_letter_stories(text):
            key = (raw_story.title, raw_story.letter)
            text_sig = raw_story.text[:80] if raw_story.text else ""
            if key not in seen_keys and text_sig not in seen_text_starts:
                seen_keys.add(key)
                seen_text_starts.add(text_sig)
                stories.append(raw_story)

        for raw_story in self._extract_sep4_stories(text):
            key = (raw_story.title, raw_story.letter)
            text_sig = raw_story.text[:80] if raw_story.text else ""
            if key not in seen_keys and text_sig not in seen_text_starts:
                seen_keys.add(key)
                seen_text_starts.add(text_sig)
                stories.append(raw_story)

        return stories

    def _extract_letter_stories(self, text: str) -> list[RawStory]:
        stories: list[RawStory] = []
        for match in LETTER_PATTERN.finditer(text):
            letter = match.group(1).strip()
            if letter not in ROMAN:
                continue
            after_letter = text[match.end() :]
            pos = match.start()
            before = text[max(0, pos - 150) : pos]
            title = self._extract_title(before)
            if not self._is_valid_title(title):
                continue
            subtitle, story_text = self._extract_subtitle_and_text(after_letter)
            if len(story_text) < 50:
                continue
            if self._is_ui_text(story_text):
                continue
            stories.append(
                RawStory(title=title, letter=letter, subtitle=subtitle, text=story_text)
            )
        return stories

    def _extract_sep4_stories(self, text: str) -> list[RawStory]:
        stories: list[RawStory] = []
        known_titles = set(JOURNAL_ARC_NAMES)

        for match in LETTER_PATTERN.finditer(text):
            letter = match.group(1).strip()
            if letter not in ROMAN:
                continue
            pos = match.start()

            title, title_end = self._find_title_after_letter(text, pos)
            if not title or not self._is_valid_title(title):
                continue

            if title in known_titles:
                known_titles.discard(title)

            story_text, next_title_start = self._find_sep4_text_before(text, title_end)
            if (
                story_text
                and len(story_text) >= 50
                and not self._is_ui_text(story_text)
            ):
                stories.append(
                    RawStory(title=title, letter=letter, subtitle="", text=story_text)
                )

        for title in known_titles:
            idx = text.find(title)
            if idx < 0:
                continue
            story_text = self._find_sep4_text_around_title(text, title, idx)
            if (
                story_text
                and len(story_text) >= 50
                and not self._is_ui_text(story_text)
            ):
                stories.append(
                    RawStory(title=title, letter="", subtitle="", text=story_text)
                )

        return stories

    def _find_title_after_letter(self, text: str, letter_end: int) -> tuple[str, int]:
        region = text[letter_end : letter_end + 200]
        title_start = -1
        for i, c in enumerate(region):
            code = ord(c)
            if code >= 32:
                title_start = i
                break
        if title_start < 0:
            return "", letter_end
        title_chars: list[str] = []
        for c in region[title_start:]:
            code = ord(c)
            if code >= 32:
                title_chars.append(c)
            else:
                break
        title = "".join(title_chars).strip()
        if self._is_valid_title(title):
            return title, letter_end + title_start + len(title)
        return "", letter_end

    def _find_sep4_text_before(self, text: str, title_start: int) -> tuple[str, int]:
        search_start = max(0, title_start - 5000)
        region = text[search_start:title_start]
        best_sep = -1
        for i in range(len(region) - 1, -1, -1):
            if ord(region[i]) == 4:
                best_sep = i
                break
        if best_sep < 0:
            return "", title_start
        raw = region[best_sep + 1 :]
        story = self._clean_quoted_text(raw)
        return story, title_start

    def _find_sep4_text_around_title(
        self, text: str, title: str, title_idx: int
    ) -> str:
        region_start = max(0, title_idx - 3000)
        region = text[region_start:title_idx]
        last_sep4 = -1
        for i in range(len(region) - 1, -1, -1):
            if ord(region[i]) == 4:
                last_sep4 = i
                break
        if last_sep4 >= 0:
            raw = region[last_sep4 + 1 :]
            story = self._clean_quoted_text(raw)
            if story:
                return story
        return ""

    @staticmethod
    def _clean_quoted_text(raw: str) -> str:
        stripped = raw.strip()
        if stripped.startswith('"'):
            stripped = stripped[1:]
        if stripped.endswith('"'):
            stripped = stripped[:-1]
        clean: list[str] = []
        for c in stripped:
            code = ord(c)
            if code in STORY_TEXT_STOP:
                break
            if code == 10 or code == 13:
                clean.append("\n")
            elif code >= 32:
                clean.append(c)
            elif code >= 0xD800:
                continue
            elif len(clean) > 100:
                break
        result = "".join(clean).strip()
        result = result.replace('""', '"')
        result = re.sub(r"\[2014\]", "\u2014", result)
        result = re.sub(r"\[2026\]", "\u2026", result)
        result = re.sub(r'<style="[^"]*">', "", result)
        result = re.sub(r"</style>", "", result)
        result = re.sub(r"<[^>]+>", "", result)
        return result.strip()

    @staticmethod
    def _is_valid_title(title: str) -> bool:
        if len(title) < 2 or len(title) > 60:
            return False
        if "\n" in title or "\r" in title or "\t" in title:
            return False
        forbidden = set("?!.\u2026\u00b7\u2014\u2013\u201c\u201d\u2018\u2019")
        if any(c in title for c in forbidden):
            return False
        if "..." in title:
            return False
        if len(title) > 0 and title[0].islower():
            return False
        if title.startswith("Letter "):
            return False
        if len(title.split()) > 6:
            return False
        return True

    @staticmethod
    def _extract_title(before: str) -> str:
        title_start = 0
        for i in range(len(before) - 1, -1, -1):
            if ord(before[i]) < 32 and before[i] not in (" ", "\t"):
                title_start = i + 1
                break
        raw = before[title_start:].strip()
        return "".join(c for c in raw if ord(c) >= 32 or c in " \t")

    @staticmethod
    def _extract_subtitle_and_text(after: str) -> tuple[str, str]:
        subtitle_parts: list[str] = []
        story_start = -1
        for i, c in enumerate(after[:300]):
            code = ord(c)
            if code in (3, 4, 6):
                story_start = i + 1
                break
            if code < 32 and code not in (32, 9):
                subtitle_parts.append(" ")
            else:
                subtitle_parts.append(c)
        subtitle = "".join(subtitle_parts).strip().strip("'\"")
        clean_text = ""
        if story_start > 0:
            clean_text = LocalizationTextExtractor._extract_text(after, story_start)
        return subtitle, clean_text

    @staticmethod
    def _extract_text(text: str, start: int) -> str:
        clean: list[str] = []
        for c in text[start : start + 10000]:
            code = ord(c)
            if code in STORY_TEXT_STOP:
                break
            if code == 10 or code == 13:
                clean.append("\n")
            elif code >= 32:
                clean.append(c)
            elif code >= 0xD800:
                continue
            elif len(clean) > 100:
                break
        result = "".join(clean).strip()
        result = result.strip("'\"")
        result = result.replace('""', '"')
        result = re.sub(r"\[2014\]", "\u2014", result)
        result = re.sub(r"\[2026\]", "\u2026", result)
        result = re.sub(r'<style="[^"]*">', "", result)
        result = re.sub(r"</style>", "", result)
        result = re.sub(r"<[^>]+>", "", result)
        return result.strip()

    @staticmethod
    def _is_ui_text(text: str) -> bool:
        if "MClear" in text or "WClear" in text:
            return True
        if "NClear" in text or "HClear" in text:
            return True
        if "Reach Spirit Siphon" in text:
            return True
        if "dialog" in text.lower() and "battle" in text.lower():
            return True
        if "Tap to" in text:
            return True
        if "Cannot be dispelled" in text:
            return True
        if "Takes P. DMG equal to" in text:
            return True
        if "game logs" in text.lower():
            return True
        if "diagnostic purposes" in text.lower():
            return True
        if "New Case" in text and "detective" in text.lower():
            return False
        return False

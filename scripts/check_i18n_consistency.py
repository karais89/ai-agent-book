#!/usr/bin/env python3
"""한국어 기본판과 영어판의 구조 일관성을 검사한다."""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAPTERS = tuple(range(1, 11))
LOCALES = ("ko", "en")
BOOK_FILES = (
    "introduction.md",
    *(f"chapter{n}.md" for n in CHAPTERS),
    "afterword.md",
    "reference-answers.md",
)


@dataclass(frozen=True)
class MarkdownShape:
    headings: tuple[int, ...]
    fenced_blocks: int
    images: int
    footnote_definitions: tuple[str, ...]


def main_readme(locale: str) -> Path:
    return ROOT / "README.md" if locale == "ko" else ROOT / "docs/en/README.md"


def learning(locale: str) -> Path:
    return ROOT / f"docs/{locale}/LEARNING.md"


def chapter_readme(locale: str, number: int) -> Path:
    suffix = "" if locale == "ko" else ".en"
    return ROOT / f"chapter{number}/README{suffix}.md"


def book_dir(locale: str) -> Path:
    return ROOT / ("book" if locale == "ko" else "book-en")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def project_count(path: Path) -> int:
    if not path.exists():
        return -1
    row = re.compile(r"^\|.*\| [✅📖🚧]+ \|")
    return sum(bool(row.match(line)) for line in read(path).splitlines())


def clone_count(path: Path) -> int:
    if not path.exists():
        return -1
    return len(re.findall(r"^git clone ", read(path), re.MULTILINE))


def overview_columns(path: Path) -> int:
    if not path.exists():
        return -1
    for line in read(path).splitlines():
        if re.match(r"^\| \d+ \|", line):
            return line.count("|") - 1
    return -1


def markdown_shape(path: Path) -> MarkdownShape:
    headings: list[int] = []
    footnotes: list[str] = []
    fenced_blocks = 0
    images = 0
    in_fence = False

    for line in read(path).splitlines():
        if re.match(r"^\s*(```|~~~)", line):
            in_fence = not in_fence
            if in_fence:
                fenced_blocks += 1
            continue
        if in_fence:
            continue
        match = re.match(r"^(#{1,6})\s+", line)
        if match:
            headings.append(len(match.group(1)))
        images += len(re.findall(r"!\[[^\]]*]\([^)]+\)", line))
        footnote = re.match(r"^\[\^([^\]]+)]\s*:", line)
        if footnote:
            footnotes.append(footnote.group(1))

    return MarkdownShape(
        headings=tuple(headings),
        fenced_blocks=fenced_blocks,
        images=images,
        footnote_definitions=tuple(sorted(footnotes)),
    )


def discover_stray_locales() -> list[str]:
    stray: list[str] = []
    docs = ROOT / "docs"
    if docs.exists():
        for child in docs.iterdir():
            if child.is_dir() and (child / "README.md").exists() and child.name not in LOCALES:
                stray.append(f"docs/{child.name}")
    for path in ROOT.glob("chapter*/README.*.md"):
        suffix = path.name.removeprefix("README.").removesuffix(".md")
        if suffix != "en":
            stray.append(str(path.relative_to(ROOT)))
    for path in ROOT.glob("book-*"):
        if path.is_dir() and path.name != "book-en":
            stray.append(path.name)
    return sorted(stray)


def main() -> int:
    errors: list[str] = []

    print("== 한국어·영어 문서 구조 검사 ==")

    for locale in LOCALES:
        required = [main_readme(locale), learning(locale)]
        required.extend(chapter_readme(locale, n) for n in CHAPTERS)
        required.extend(book_dir(locale) / name for name in BOOK_FILES)
        missing = [str(path.relative_to(ROOT)) for path in required if not path.exists()]
        if missing:
            errors.append(f"{locale}: 필수 파일 누락 — {', '.join(missing)}")
        else:
            print(f"  ✓ {locale}: 필수 문서 {len(required)}개")

    for locale in LOCALES:
        columns = overview_columns(main_readme(locale))
        if columns < 5:
            errors.append(f"{locale}: README 내용 표가 5열 미만({columns})")

    ko_clones = clone_count(main_readme("ko"))
    en_clones = clone_count(main_readme("en"))
    if ko_clones != en_clones:
        errors.append(f"git clone 명령 수 불일치: ko={ko_clones}, en={en_clones}")

    ko_counts = [project_count(chapter_readme("ko", n)) for n in CHAPTERS]
    en_counts = [project_count(chapter_readme("en", n)) for n in CHAPTERS]
    if ko_counts != en_counts:
        errors.append(f"장별 실습 수 불일치: ko={ko_counts}, en={en_counts}")
    else:
        print(f"  ✓ 장별 실습 {sum(ko_counts)}개: {ko_counts}")

    for name in BOOK_FILES:
        ko_path = book_dir("ko") / name
        en_path = book_dir("en") / name
        if not ko_path.exists() or not en_path.exists():
            continue
        ko_shape = markdown_shape(ko_path)
        en_shape = markdown_shape(en_path)
        if ko_shape != en_shape:
            errors.append(
                f"{name}: Markdown 구조 불일치 "
                f"(제목 {len(ko_shape.headings)}/{len(en_shape.headings)}, "
                f"코드 {ko_shape.fenced_blocks}/{en_shape.fenced_blocks}, "
                f"그림 {ko_shape.images}/{en_shape.images}, "
                f"각주 {len(ko_shape.footnote_definitions)}/{len(en_shape.footnote_definitions)})"
            )

    strays = discover_stray_locales()
    if strays:
        errors.append("허용하지 않은 번역판 잔존 — " + ", ".join(strays))

    mkdocs = read(ROOT / "mkdocs.yml")
    if "  language: ko" not in mkdocs:
        errors.append("mkdocs.yml의 기본 테마 언어가 ko가 아님")
    for legacy in ("book-ar/", "book-ja/", "book-ru/", "book-ta/", "book-vi/", "book-zhtw/"):
        if legacy in mkdocs:
            errors.append(f"mkdocs.yml에 제거한 언어 경로가 남음: {legacy}")

    if errors:
        print(f"\n❌ {len(errors)}개 문제:")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("✓ 한국어·영어판 구조가 일치합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

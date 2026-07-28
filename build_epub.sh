#!/usr/bin/env bash
# Build the Korean and English EPUB 3 editions.
# Usage: ./build_epub.sh [all|ko|en]

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SELECTION="${1:-all}"

for command in pandoc pdftoppm python3; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Error: $command is required." >&2
        exit 1
    fi
done

case "$SELECTION" in
    all|ko|en) ;;
    *)
        echo "Usage: $0 [all|ko|en]" >&2
        exit 2
        ;;
esac

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ai-agent-book-epub.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

build_edition() {
    local language="$1"
    local directory title author pdf output title_label toc_label
    local -a chapters

    case "$language" in
        ko)
            directory="book"
            title="AI 에이전트 깊이 이해하기: 설계 원리와 엔지니어링 실무"
            author="Bojie Li; 한국어 번역: karais89"
            pdf="AI-Agents-in-Depth-ko.pdf"
            output="AI-Agents-in-Depth-ko.epub"
            title_label="표제지"
            toc_label="목차"
            chapters=(introduction.md chapter{1..10}.md afterword.md reference-answers.md)
            ;;
        en)
            directory="book-en"
            title="AI Agents in Depth: Design Principles and Engineering Practice"
            author="Bojie Li; English translation: Devaraj"
            pdf="AI-Agents-in-Depth-Bojie-Li-v1.3.pdf"
            output="AI-Agents-in-Depth-Bojie-Li-v1.3.epub"
            title_label="Title Page"
            toc_label="Table of Contents"
            chapters=(introduction.md chapter{1..10}.md afterword.md reference-answers.md)
            ;;
    esac

    local edition_dir="$ROOT/$directory"
    local chapter
    for chapter in "${chapters[@]}" "$pdf"; do
        if [ ! -f "$edition_dir/$chapter" ]; then
            echo "Error: $directory/$chapter not found." >&2
            exit 1
        fi
    done

    local cover="$TMP_DIR/cover-$language.jpg"
    pdftoppm -f 1 -singlefile -jpeg -r 160 \
        "$edition_dir/$pdf" "${cover%.jpg}"

    echo "Building $language EPUB..."
    (
        cd "$edition_dir"
        pandoc "${chapters[@]}" \
            -o "$output" \
            --from markdown+lists_without_preceding_blankline \
            --to epub3 \
            --standalone \
            --toc \
            --toc-depth=3 \
            --number-sections \
            --mathml \
            --split-level=1 \
            --highlight-style=kate \
            --css="$ROOT/epub.css" \
            --epub-cover-image="$cover" \
            --metadata title="$title" \
            --metadata author="$author" \
            --metadata lang="$language" \
            --metadata identifier="https://github.com/karais89/ai-agent-book#$language"
    )

    python3 "$ROOT/flatten_epub_toc.py" \
        "$edition_dir/$output" "$title_label" "$toc_label"

    if command -v epubcheck >/dev/null 2>&1; then
        epubcheck "$edition_dir/$output"
    else
        echo "Built $directory/$output (install epubcheck to validate it)."
    fi
}

if [ "$SELECTION" = "all" ]; then
    for language in ko en; do
        build_edition "$language"
    done
else
    build_edition "$SELECTION"
fi

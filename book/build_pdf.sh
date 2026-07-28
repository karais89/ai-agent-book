#!/bin/bash
# Build the complete book as a single PDF (ElegantBook design, teal/cyan theme).
# Requirements: pandoc, xelatex, ElegantBook class, rsvg-convert (librsvg),
#               Noto Serif/Sans CJK KR (or the macOS Korean system fonts)
# Usage: cd book && bash build_pdf.sh
# Note: chapter/section numbers come from the document class; source headings
#       carry no manual numbers (see git history for the de-numbering pass).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# The full book can exceed XeTeX's default runtime memory during page output.
# Extend the existing format without rebuilding it.
export extra_mem_top=8000000
export extra_mem_bot=8000000
# Avoid slow, failing METAFONT probes when a fallback font is unavailable.
export MKTEXTFM=0

OUT="AI-Agents-in-Depth-ko.pdf"
CHAPTERS=(
    introduction.md
    chapter1.md
    chapter2.md
    chapter3.md
    chapter4.md
    chapter5.md
    chapter6.md
    chapter7.md
    chapter8.md
    chapter9.md
    chapter10.md
    afterword.md
    reference-answers.md
)

# Verify all chapters exist
for ch in "${CHAPTERS[@]}"; do
    if [ ! -f "$ch" ]; then
        echo "Error: $ch not found" >&2
        exit 1
    fi
done

echo "Building PDF from ${#CHAPTERS[@]} files..."

pandoc "${CHAPTERS[@]}" \
    -o "$OUT" \
    --from markdown+lists_without_preceding_blankline \
    --pdf-engine=xelatex \
    --lua-filter=crossref.lua \
    --lua-filter=experiment_box.lua \
    --toc \
    --toc-depth=3 \
    --number-sections \
    -V documentclass=elegantbook \
    -V classoption=lang=cn \
    -V classoption=nofont \
    -V classoption=cyan \
    -V classoption=device=normal \
    -V author="Bojie Li" \
    --metadata title-meta="AI 에이전트 깊이 이해하기: 설계 원리와 엔지니어링 실무" \
    --metadata author-meta="Bojie Li (한국어 번역: karais89)" \
    -H preamble.tex \
    --include-before-body=cover.tex \
    --highlight-style=kate \
    --columns=80 \
    2>&1

if [ -f "$OUT" ]; then
    SIZE=$(du -h "$OUT" | cut -f1)
    PAGES=$(python3 -c "
import subprocess, re
r = subprocess.run(['pdfinfo', '$OUT'], capture_output=True, text=True)
m = re.search(r'Pages:\s+(\d+)', r.stdout)
print(m.group(1) if m else '?')
" 2>/dev/null || echo "?")
    echo ""
    echo "Done: $OUT ($SIZE, $PAGES pages)"
else
    echo "Error: PDF generation failed" >&2
    exit 1
fi

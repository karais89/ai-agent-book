#!/usr/bin/env python3
"""Generate the Korean and English Open Graph / Twitter share cards.

The static 1200x630 PNG files are checked into the repo. Regenerate them
only when the branding text changes. scripts/seo_meta.py selects the card
that matches each page's language.

The generator uses the Korean system font bundled with macOS.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

KOREAN_FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

# fenix palette (keep in sync with extras/book-theme.css)
INK, SOFT, MUTE = "#2c3e50", "#57606a", "#8b949e"
GREEN, BORDER, BG_SOFT = "#42b983", "#eaecef", "#f6f8fa"


def card(*, title: str, subtitle: str, formula: str, footer: str) -> Image.Image:
    img = Image.new("RGB", (W, H), "#ffffff")
    d = ImageDraw.Draw(img)

    title_f = ImageFont.truetype(KOREAN_FONT, 82, index=8)
    sub_f = ImageFont.truetype(KOREAN_FONT, 32, index=4)
    mono_f = ImageFont.truetype(KOREAN_FONT, 38, index=4)
    foot_f = ImageFont.truetype(KOREAN_FONT, 26, index=4)

    x = 96
    d.text((x, 128), title, font=title_f, fill=INK)
    d.text((x, 270), subtitle, font=sub_f, fill=SOFT)

    # The book's core formula, in a flat code-chip
    fy, fh = 374, 84
    fw = d.textlength(formula, font=mono_f) + 72
    d.rounded_rectangle([x, fy, x + fw, fy + fh], radius=8,
                        fill=BG_SOFT, outline=BORDER, width=2)
    d.text((x + 36, fy + 21), formula, font=mono_f, fill=GREEN)

    d.text((x, 528), footer, font=foot_f, fill=MUTE)
    d.rectangle([0, H - 10, W, H], fill=GREEN)
    return img


def main() -> None:
    cards = {
        "assets/og-card.png": {
            "title": "AI 에이전트 깊이 이해하기",
            "subtitle": "설계 원리와 엔지니어링 실무 · 완전한 오픈 소스 기술서",
            "formula": "에이전트 = LLM + 컨텍스트 + 도구",
            "footer": "karais89/ai-agent-book · 본문 10장 · 실습 93개 · 한국어/영어",
        },
        "assets/og-card-en.png": {
            "title": "AI Agents in Depth",
            "subtitle": "Design Principles and Engineering Practice · Open-source book",
            "formula": "Agent = LLM + Context + Tools",
            "footer": "karais89/ai-agent-book · 10 chapters · 93 experiments · Korean/English",
        },
    }
    for output, values in cards.items():
        card(**values).save(output, optimize=True)
        print(f"wrote {output}")


if __name__ == "__main__":
    main()

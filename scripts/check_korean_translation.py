#!/usr/bin/env python3
"""한국어 책 본문의 번역 누락과 구조 손상을 검사한다."""

from __future__ import annotations

import hashlib
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KO = ROOT / "book"
EN = ROOT / "book-en"
FILES = (
    "introduction.md",
    *(f"chapter{n}.md" for n in range(1, 11)),
    "afterword.md",
    "reference-answers.md",
)
FORBIDDEN_PATTERNS = {
    "하니스": r"하니스",
    "문맥 공학": r"문맥 공학",
    "서브에이전트": r"서브에이전트",
    "후학습": r"(?<!사)후학습",
}
URL_MIGRATIONS = {
    "https://github.com/bojieli/ai-agent-book": "https://github.com/karais89/ai-agent-book"
}


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def fenced_blocks(source: str) -> list[tuple[str, str]]:
    return [
        (match.group("info").strip(), match.group("body"))
        for match in re.finditer(
            r"^(?P<fence>`{3,}|~{3,})(?P<info>[^\n]*)\n"
            r"(?P<body>.*?)^(?P=fence)\s*$",
            source,
            flags=re.MULTILINE | re.DOTALL,
        )
    ]


def executable_fenced_blocks(source: str) -> list[tuple[str, str]]:
    return [
        block
        for block in fenced_blocks(source)
        if block[0]
        and block[0].split(maxsplit=1)[0].lower()
        in {"python", "javascript", "json", "yaml"}
    ]


def outside_fences(source: str) -> str:
    return re.sub(
        r"^(?:`{3,}|~{3,})[^\n]*\n.*?^(?:`{3,}|~{3,})\s*$",
        lambda match: "\n" * match.group(0).count("\n"),
        source,
        flags=re.MULTILINE | re.DOTALL,
    )


def headings(source: str) -> tuple[int, ...]:
    return tuple(
        len(match.group(1))
        for match in re.finditer(r"^(#{1,6})\s+", outside_fences(source), re.MULTILINE)
    )


def heading_attributes(source: str) -> tuple[str, ...]:
    attributes: list[str] = []
    for line in outside_fences(source).splitlines():
        if re.match(r"^#{1,6}\s+", line):
            match = re.search(r"(\{[^}\n]+\})\s*$", line)
            attributes.append(match.group(1) if match else "")
    return tuple(attributes)


def images(source: str) -> Counter[str]:
    return Counter(re.findall(r"!\[[^\]]*]\(([^)\s]+)", outside_fences(source)))


def image_attributes(source: str) -> Counter[str]:
    return Counter(
        re.findall(
            r"!\[[^\]]*]\([^)]+\)(\{[^}\n]*\})?",
            outside_fences(source),
        )
    )


def link_targets(source: str) -> Counter[str]:
    targets = Counter(
        URL_MIGRATIONS.get(target, target)
        for target in re.findall(r"(?<!!)\[[^\]]*]\(([^)\s]+)", outside_fences(source))
        if not target.startswith("#")
    )
    return targets


def footnotes(source: str) -> tuple[Counter[str], Counter[str]]:
    clean = outside_fences(source)
    definitions = Counter(
        re.findall(r"^\[\^([^\]]+)]\s*:", clean, re.MULTILINE)
    )
    references = Counter(re.findall(r"\[\^([^\]]+)]", clean))
    for key, count in definitions.items():
        references[key] -= count
    return definitions, +references


def inline_code(source: str) -> Counter[str]:
    localized_examples = {
        "[선택 읽기]": "[Optional Reading]",
        "[확장 실험]": "[Extended Experiment]",
        "[아내 Patricia Thompson이 최초 송금을 설정 중]":
            "[Wife Patricia Thompson is setting up the initial wire transfer]",
        "[남편 James Thompson이 기존 송금을 수정 중]":
            "[Husband James Thompson is modifying the previous wire transfer]",
        "[아내가 남편의 변경 뒤 송금을 다시 수정 중]":
            "[Wife is modifying the wire transfer again after the husband's change]",
    }

    return Counter(
        localized_examples.get(
            match.group(2),
            re.sub(
                r"^chapter(\d+)_ko\.md$",
                r"chapter\1_zh.md",
                match.group(2),
            ),
        )
        for match in re.finditer(r"(`+)(.+?)\1", outside_fences(source))
        if "\n" not in match.group(2)
    )


def display_math(source: str) -> Counter[str]:
    clean = outside_fences(source)
    return Counter(
        re.findall(r"\$\$(.*?)\$\$", clean, re.DOTALL)
        + re.findall(r"\\\[(.*?)\\\]", clean, re.DOTALL)
    )


def html_tags(source: str) -> Counter[str]:
    return Counter(re.findall(r"</?[A-Za-z][^>]*>", outside_fences(source)))


def table_shapes(source: str) -> tuple[int, ...]:
    return tuple(
        line.count("|")
        for line in outside_fences(source).splitlines()
        if line.lstrip().startswith("|")
    )


def blockquote_depths(source: str) -> tuple[int, ...]:
    depths: list[int] = []
    for line in outside_fences(source).splitlines():
        if match := re.match(r"^(?:>\s*)+", line):
            depths.append(match.group(0).count(">"))
    return tuple(depths)


def list_shapes(source: str) -> tuple[tuple[int, str], ...]:
    result: list[tuple[int, str]] = []
    for line in outside_fences(source).splitlines():
        if match := re.match(r"^(\s*)([-+*]|\d+[.)])\s+", line):
            marker = "ordered" if match.group(2)[0].isdigit() else "bullet"
            result.append((len(match.group(1)), marker))
    return tuple(result)


def urls(source: str) -> Counter[str]:
    return Counter(
        value.rstrip(".,;:")
        for value in re.findall(
            r"https?://[A-Za-z0-9._~:/?#@!$&*+,;=%-]+",
            source,
        )
    )


def migrated_urls(source: str) -> Counter[str]:
    for old, new in URL_MIGRATIONS.items():
        source = re.sub(re.escape(old) + r"(?!/)", new, source)
    return urls(source)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def broken_relative_links(path: Path) -> list[str]:
    broken: list[str] = []
    source = outside_fences(text(path))
    for target in re.findall(r"!?\[[^\]]*]\(([^)]+)\)", source):
        target = target.split(maxsplit=1)[0].strip("<>")
        if (
            not target
            or target.startswith(("http://", "https://", "mailto:", "#", "data:"))
        ):
            continue
        target = target.split("#", 1)[0].split("?", 1)[0]
        if target and not (path.parent / target).resolve().exists():
            broken.append(target)
    return broken


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    for name in FILES:
        ko_path = KO / name
        en_path = EN / name
        if not ko_path.exists() or not en_path.exists():
            errors.append(f"{name}: 원문 또는 번역 파일 누락")
            continue

        ko_text = text(ko_path)
        en_text = text(en_path)

        if headings(ko_text) != headings(en_text):
            errors.append(f"{name}: 제목 단계/개수 불일치")
        if heading_attributes(ko_text) != heading_attributes(en_text):
            errors.append(f"{name}: 제목 속성 불일치")
        if [info for info, _ in fenced_blocks(ko_text)] != [
            info for info, _ in fenced_blocks(en_text)
        ]:
            errors.append(f"{name}: 코드 블록 언어/개수 불일치")
        if executable_fenced_blocks(ko_text) != executable_fenced_blocks(en_text):
            errors.append(f"{name}: 실행 코드 블록 내용 불일치")
        if images(ko_text) != images(en_text):
            errors.append(f"{name}: 이미지 참조 불일치")
        if image_attributes(ko_text) != image_attributes(en_text):
            errors.append(f"{name}: 이미지 속성 불일치")
        if link_targets(ko_text) != link_targets(en_text):
            errors.append(f"{name}: 링크 대상 불일치")
        if footnotes(ko_text) != footnotes(en_text):
            errors.append(f"{name}: 각주 식별자 불일치")
        if inline_code(ko_text) != inline_code(en_text):
            errors.append(f"{name}: 인라인 코드 불일치")
        if display_math(ko_text) != display_math(en_text):
            errors.append(f"{name}: 디스플레이 수식 불일치")
        if html_tags(ko_text) != html_tags(en_text):
            errors.append(f"{name}: HTML 태그 불일치")
        if table_shapes(ko_text) != table_shapes(en_text):
            errors.append(f"{name}: 표 구조 불일치")
        if blockquote_depths(ko_text) != blockquote_depths(en_text):
            errors.append(f"{name}: 인용문 구조 불일치")
        if list_shapes(ko_text) != list_shapes(en_text):
            errors.append(f"{name}: 목록 구조 불일치")
        if urls(ko_text) != migrated_urls(en_text):
            errors.append(f"{name}: URL 불일치")

        for term, pattern in FORBIDDEN_PATTERNS.items():
            if re.search(pattern, outside_fences(ko_text)):
                errors.append(f"{name}: 비권장 용어 `{term}` 발견")

        broken = broken_relative_links(ko_path)
        if broken:
            errors.append(f"{name}: 깨진 상대 링크 — {', '.join(sorted(set(broken)))}")

        for line_number, line in enumerate(outside_fences(ko_text).splitlines(), 1):
            latin = len(re.findall(r"[A-Za-z]", line))
            hangul = len(re.findall(r"[가-힣]", line))
            if latin >= 100 and hangul < 5 and not line.lstrip().startswith(("#", "|", "<")):
                warnings.append(f"{name}:{line_number}: 영문 번역 누락 가능성")
            if len(re.findall(r"[\u4e00-\u9fff]", line)) >= 4:
                warnings.append(f"{name}:{line_number}: 한자 문구 잔존 가능성")

        for block_number, (info, body) in enumerate(fenced_blocks(ko_text), 1):
            if (
                not info
                and len(re.findall(r"[A-Za-z]", body)) >= 120
                and not re.search(r"[가-힣]", body)
            ):
                warnings.append(
                    f"{name}: 코드 블록 {block_number}: 영문 프롬프트/예시 보존 확인"
                )

    ko_images = KO / "images"
    en_images = EN / "images"
    for en_svg in sorted(en_images.glob("*.svg")):
        ko_svg = ko_images / en_svg.name
        if not ko_svg.exists():
            errors.append(f"images/{en_svg.name}: 한국어 SVG 누락")
            continue

        try:
            en_root = ET.parse(en_svg).getroot()
            ko_root = ET.parse(ko_svg).getroot()
        except ET.ParseError as error:
            errors.append(f"images/{en_svg.name}: XML 파싱 실패 — {error}")
            continue

        en_nodes = [
            node for node in en_root.iter() if node.tag.rsplit("}", 1)[-1] in {"text", "tspan"}
        ]
        ko_nodes = [
            node for node in ko_root.iter() if node.tag.rsplit("}", 1)[-1] in {"text", "tspan"}
        ]
        if len(en_nodes) != len(ko_nodes):
            errors.append(
                f"images/{en_svg.name}: text/tspan 노드 수 불일치 "
                f"({len(ko_nodes)} != {len(en_nodes)})"
            )

        en_all = list(en_root.iter())
        ko_all = list(ko_root.iter())
        if [node.tag.rsplit("}", 1)[-1] for node in en_all] != [
            node.tag.rsplit("}", 1)[-1] for node in ko_all
        ]:
            errors.append(f"images/{en_svg.name}: SVG 요소 구조 불일치")
        else:
            for en_node, ko_node in zip(en_all, ko_all):
                tag = en_node.tag.rsplit("}", 1)[-1]
                if tag in {"text", "tspan"}:
                    ignored = {"font-family", "font-size"}
                    en_attrs = {
                        key: value for key, value in en_node.attrib.items() if key not in ignored
                    }
                    ko_attrs = {
                        key: value for key, value in ko_node.attrib.items() if key not in ignored
                    }
                    if en_attrs != ko_attrs:
                        errors.append(
                            f"images/{en_svg.name}: {tag} 위치/스타일 속성 불일치"
                        )
                        break
                elif en_node.attrib != ko_node.attrib:
                    errors.append(
                        f"images/{en_svg.name}: 비텍스트 도형 속성 불일치 ({tag})"
                    )
                    break
        if en_nodes and sha256(ko_svg) == sha256(en_svg):
            errors.append(f"images/{en_svg.name}: 영어 SVG와 완전히 동일")

        visible = " ".join(
            "".join(node.itertext()).strip() for node in ko_nodes if "".join(node.itertext()).strip()
        )
        en_visible = " ".join(
            "".join(node.itertext()).strip() for node in en_nodes if "".join(node.itertext()).strip()
        )
        source_requires_translation = (
            len(re.findall(r"[A-Za-z][A-Za-z-]+", en_visible)) >= 5
            or len(re.findall(r"[\u3400-\u4dbf\u4e00-\u9fff]", en_visible)) >= 4
        )
        if source_requires_translation and not re.search(r"[가-힣]", visible):
            errors.append(f"images/{en_svg.name}: 번역된 한글 가시 텍스트 없음")
        for node in ko_nodes:
            value = "".join(node.itertext()).strip()
            latin_words = re.findall(r"[A-Za-z][A-Za-z-]+", value)
            if len(latin_words) >= 5 and not re.search(r"[가-힣]", value):
                warnings.append(
                    f"images/{en_svg.name}: 영문 문구 잔존 가능성 — {value[:80]}"
                )

    print("== 한국어 번역 품질 검사 ==")
    if warnings:
        print(f"⚠️ 검토 권장 {len(warnings)}건")
        for warning in warnings[:30]:
            print(f"  - {warning}")
        if len(warnings) > 30:
            print(f"  - … 나머지 {len(warnings) - 30}건")

    if errors:
        print(f"❌ 오류 {len(errors)}건")
        for error in errors:
            print(f"  - {error}")
        return 1

    print("✓ 본문 구조, 코드, 링크, 각주, 그림 판본이 일치합니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

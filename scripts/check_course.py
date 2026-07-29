#!/usr/bin/env python3
"""Validate the static beginner-course manifest, pages, data, and quizzes."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "extras/course/data/course-v1.json"
EXPECTED_MODULE_IDS = {
    "01-agent",
    "02-context",
    "03-tools",
    "04-harness",
    "05-evaluation",
    "06-improvement",
}
REQUIRED_COURSE_PAGES = {
    "course/index.md",
    "course/00-overview.md",
    "course/project.md",
    "course/glossary.md",
    "course/completion.md",
}
MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\(([^)\s]+)")


class DuplicateKeyError(ValueError):
    """Raised when a JSON object contains the same key more than once."""


def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError(f"중복 JSON 키: {key}")
        result[key] = value
    return result


def read_json(path: Path, errors: list[str]) -> Any:
    try:
        return json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=reject_duplicate_keys,
        )
    except FileNotFoundError:
        errors.append(f"파일 없음: {relative(path)}")
    except (json.JSONDecodeError, DuplicateKeyError) as exc:
        errors.append(f"JSON 오류: {relative(path)}: {exc}")
    return None


def relative(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def nonempty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def repo_path(value: Any, label: str, errors: list[str]) -> Path | None:
    if not nonempty_string(value):
        errors.append(f"{label}: 비어 있거나 문자열이 아닌 경로")
        return None
    raw = value.strip()
    candidate = (ROOT / raw).resolve()
    try:
        candidate.relative_to(ROOT.resolve())
    except ValueError:
        errors.append(f"{label}: 저장소 밖을 가리키는 경로: {raw}")
        return None
    return candidate


def require_file(value: Any, label: str, errors: list[str]) -> Path | None:
    path = repo_path(value, label, errors)
    if path is not None and not path.is_file():
        errors.append(f"{label}: 파일 없음: {relative(path)}")
    return path


def validate_overview(manifest: dict[str, Any], errors: list[str]) -> None:
    overview = manifest.get("overview")
    if not isinstance(overview, dict):
        errors.append("manifest.overview는 객체여야 합니다")
        return
    if overview.get("id") != "00-overview":
        errors.append("overview.id는 00-overview여야 합니다")
    validate_web_path(overview.get("path"), "overview.path", errors)
    page = require_file(overview.get("page"), "overview.page", errors)
    if page and page.is_file() and page != ROOT / "course/00-overview.md":
        errors.append("overview.page는 course/00-overview.md여야 합니다")
    validate_text_list(overview.get("objectives"), "overview.objectives", 1, 2, errors)
    if not nonempty_string(overview.get("checkpoint")):
        errors.append("overview.checkpoint가 비어 있습니다")
    validate_sources(overview.get("sources"), "overview.sources", errors)


def validate_web_path(value: Any, label: str, errors: list[str]) -> None:
    if not nonempty_string(value):
        errors.append(f"{label}가 비어 있습니다")
        return
    path = value.strip()
    if path.startswith("/") or ".." in Path(path).parts or not path.endswith("/"):
        errors.append(
            f"{label}는 /course/ 기준 상대 경로이며 /로 끝나야 합니다: {path}"
        )


def validate_text_list(
    value: Any,
    label: str,
    minimum: int,
    maximum: int,
    errors: list[str],
) -> None:
    if not isinstance(value, list):
        errors.append(f"{label}는 배열이어야 합니다")
        return
    if not minimum <= len(value) <= maximum:
        errors.append(f"{label} 항목 수는 {minimum}~{maximum}개여야 합니다")
    if any(not nonempty_string(item) for item in value):
        errors.append(f"{label}에 빈 문자열 또는 문자열이 아닌 항목이 있습니다")


def validate_sources(value: Any, label: str, errors: list[str]) -> None:
    if not isinstance(value, list) or not value:
        errors.append(f"{label}는 하나 이상의 원문 경로를 가져야 합니다")
        return
    for index, source in enumerate(value):
        require_file(source, f"{label}[{index}]", errors)


def tag_in_page(page_text: str, tag: str) -> bool:
    return re.search(rf"<{re.escape(tag)}(?:\s|>)", page_text) is not None


def validate_markdown_links(errors: list[str]) -> None:
    """Require every local link in the source course Markdown to exist."""

    for page in sorted((ROOT / "course").glob("*.md")):
        page_text = page.read_text(encoding="utf-8")
        for match in MARKDOWN_LINK.finditer(page_text):
            target = match.group(1).strip().strip("<>")
            if target.startswith(("#", "http://", "https://", "mailto:", "tel:")):
                continue
            path_text = unquote(target.split("#", 1)[0].split("?", 1)[0])
            if not path_text:
                continue
            candidate = (page.parent / path_text).resolve()
            try:
                candidate.relative_to(ROOT.resolve())
            except ValueError:
                errors.append(
                    f"{relative(page)}: 저장소 밖을 가리키는 링크: {target}"
                )
                continue
            if not candidate.exists():
                errors.append(
                    f"{relative(page)}: 존재하지 않는 로컬 링크: {target}"
                )


def attribute_values(page_text: str, tag: str, attribute: str) -> list[str]:
    pattern = re.compile(
        rf"<{re.escape(tag)}\b[^>]*\b{re.escape(attribute)}=[\"']([^\"']+)[\"']",
        re.IGNORECASE,
    )
    return pattern.findall(page_text)


def validate_module(
    module: Any,
    index: int,
    module_ids: set[str],
    question_ids: set[str],
    quiz_ids: set[str],
    quiz_paths: set[str],
    errors: list[str],
) -> None:
    label = f"modules[{index}]"
    if not isinstance(module, dict):
        errors.append(f"{label}는 객체여야 합니다")
        return

    module_id = module.get("id")
    if not nonempty_string(module_id):
        errors.append(f"{label}.id가 비어 있습니다")
        return
    module_id = module_id.strip()
    if module_id in module_ids:
        errors.append(f"중복 모듈 ID: {module_id}")
    module_ids.add(module_id)

    if not nonempty_string(module.get("title")):
        errors.append(f"{module_id}: title이 비어 있습니다")
    validate_web_path(module.get("path"), f"{module_id}.path", errors)
    expected_path = f"{module_id}/"
    if module.get("path") != expected_path:
        errors.append(f"{module_id}: path는 {expected_path}여야 합니다")

    page = require_file(module.get("page"), f"{module_id}.page", errors)
    expected_page = f"course/{module_id}.md"
    if module.get("page") != expected_page:
        errors.append(f"{module_id}: page는 {expected_page}여야 합니다")
    page_text = ""
    if page and page.is_file():
        page_text = page.read_text(encoding="utf-8")

    minutes = module.get("estimated_minutes")
    if not isinstance(minutes, int) or not 10 <= minutes <= 60:
        errors.append(f"{module_id}: estimated_minutes는 10~60 사이 정수여야 합니다")
    validate_text_list(module.get("objectives"), f"{module_id}.objectives", 1, 2, errors)
    validate_text_list(module.get("concepts"), f"{module_id}.concepts", 1, 5, errors)
    if not nonempty_string(module.get("checkpoint")):
        errors.append(f"{module_id}: checkpoint가 비어 있습니다")
    validate_sources(module.get("sources"), f"{module_id}.sources", errors)

    interaction = module.get("interaction")
    if not isinstance(interaction, dict):
        errors.append(f"{module_id}: interaction은 객체여야 합니다")
    else:
        tag = interaction.get("tag")
        if not nonempty_string(tag) or not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)+", tag):
            errors.append(f"{module_id}: 올바르지 않은 interaction.tag")
        elif page_text and not tag_in_page(page_text, tag):
            errors.append(f"{module_id}: 페이지에 <{tag}> 태그가 없습니다")
        require_file(interaction.get("script"), f"{module_id}.interaction.script", errors)
        if "data" in interaction:
            require_file(interaction.get("data"), f"{module_id}.interaction.data", errors)

    quiz_value = module.get("quiz")
    quiz_path = require_file(quiz_value, f"{module_id}.quiz", errors)
    if nonempty_string(quiz_value):
        quiz_paths.add(quiz_value.strip())
    if page_text:
        page_quizzes = attribute_values(page_text, "course-quiz", "data-quiz")
        expected_quiz_name = Path(str(quiz_value)).stem
        if expected_quiz_name not in page_quizzes:
            errors.append(
                f"{module_id}: <course-quiz data-quiz=\"{expected_quiz_name}\">가 없습니다"
            )
        completion_ids = attribute_values(
            page_text, "button", "data-course-complete"
        )
        if module_id not in completion_ids:
            errors.append(
                f"{module_id}: data-course-complete=\"{module_id}\" 버튼이 없습니다"
            )
    if quiz_path and quiz_path.is_file():
        quiz = read_json(quiz_path, errors)
        validate_quiz(
            quiz,
            relative(quiz_path),
            question_ids,
            quiz_ids,
            errors,
        )


def validate_quiz(
    quiz: Any,
    label: str,
    question_ids: set[str],
    quiz_ids: set[str],
    errors: list[str],
) -> None:
    if not isinstance(quiz, dict):
        errors.append(f"{label}: 최상위 값은 객체여야 합니다")
        return
    required = {"id", "title", "pass_score", "questions"}
    missing = sorted(required - quiz.keys())
    if missing:
        errors.append(f"{label}: 필수 키 누락: {', '.join(missing)}")

    quiz_id = quiz.get("id")
    if not nonempty_string(quiz_id):
        errors.append(f"{label}: id가 비어 있습니다")
    elif quiz_id in quiz_ids:
        errors.append(f"중복 퀴즈 ID: {quiz_id}")
    else:
        quiz_ids.add(quiz_id)
    if not nonempty_string(quiz.get("title")):
        errors.append(f"{label}: title이 비어 있습니다")
    pass_score = quiz.get("pass_score")
    if (
        isinstance(pass_score, bool)
        or not isinstance(pass_score, (int, float))
        or not 0 <= pass_score <= 100
    ):
        errors.append(f"{label}: pass_score는 0~100 사이 숫자여야 합니다")

    questions = quiz.get("questions")
    if not isinstance(questions, list):
        errors.append(f"{label}: questions는 배열이어야 합니다")
        return
    if len(questions) != 4:
        errors.append(f"{label}: questions는 정확히 4개여야 합니다")
    for index, question in enumerate(questions):
        validate_question(
            question,
            f"{label}.questions[{index}]",
            question_ids,
            errors,
        )


def validate_question(
    question: Any,
    label: str,
    question_ids: set[str],
    errors: list[str],
) -> None:
    if not isinstance(question, dict):
        errors.append(f"{label}: 문항은 객체여야 합니다")
        return
    required = {"id", "prompt", "options", "answer", "explanation"}
    missing = sorted(required - question.keys())
    if missing:
        errors.append(f"{label}: 필수 키 누락: {', '.join(missing)}")

    question_id = question.get("id")
    if not nonempty_string(question_id):
        errors.append(f"{label}: id가 비어 있습니다")
    elif question_id in question_ids:
        errors.append(f"중복 문항 ID: {question_id}")
    else:
        question_ids.add(question_id)
    if not nonempty_string(question.get("prompt")):
        errors.append(f"{label}: prompt가 비어 있습니다")
    if not nonempty_string(question.get("explanation")):
        errors.append(f"{label}: explanation이 비어 있습니다")

    options = question.get("options")
    if not isinstance(options, list) or len(options) < 2:
        errors.append(f"{label}: options는 두 개 이상의 선택지를 가져야 합니다")
        return
    option_ids: set[str] = set()
    for index, option in enumerate(options):
        option_label = f"{label}.options[{index}]"
        if not isinstance(option, dict):
            errors.append(f"{option_label}: 선택지는 객체여야 합니다")
            continue
        for key in ("id", "label", "feedback"):
            if not nonempty_string(option.get(key)):
                errors.append(f"{option_label}.{key}가 비어 있습니다")
        option_id = option.get("id")
        if nonempty_string(option_id):
            if option_id in option_ids:
                errors.append(f"{label}: 중복 선택지 ID: {option_id}")
            option_ids.add(option_id)

    answer = question.get("answer")
    if not nonempty_string(answer):
        errors.append(f"{label}: answer가 비어 있습니다")
    elif answer not in option_ids:
        errors.append(f"{label}: answer {answer!r}가 options의 ID에 없습니다")


def validate_scenarios(manifest: dict[str, Any], errors: list[str]) -> None:
    scenario_path = require_file(manifest.get("scenario"), "manifest.scenario", errors)
    if not scenario_path or not scenario_path.is_file():
        return
    scenario = read_json(scenario_path, errors)
    if not isinstance(scenario, dict):
        errors.append("Mori Shop 시나리오는 객체여야 합니다")
        return
    customer = scenario.get("customer")
    orders = scenario.get("orders")
    request = scenario.get("request")
    policies = scenario.get("policies")
    tools = scenario.get("tools")
    if not isinstance(customer, dict) or customer.get("id") != "C-102":
        errors.append("Mori Shop 고객 ID는 C-102여야 합니다")
    if not isinstance(orders, list) or not any(
        isinstance(order, dict)
        and order.get("id") == "O-1042"
        and order.get("total") == 89000
        for order in orders
    ):
        errors.append("Mori Shop 주문 O-1042와 금액 89000이 필요합니다")
    if not isinstance(request, dict) or request.get("initial_reason") is not None:
        errors.append("Mori Shop 첫 요청에는 환불 사유가 없어야 합니다")
    if not isinstance(request, dict) or request.get("follow_up") != "왼쪽 이어버드가 작동하지 않아요.":
        errors.append("Mori Shop 후속 결함 설명이 계획과 다릅니다")
    if not isinstance(policies, list) or not policies:
        errors.append("Mori Shop 환불 정책이 없습니다")
    if not isinstance(tools, list) or len(tools) != 8:
        errors.append("Mori Shop에는 계획에 정의된 도구 8개가 있어야 합니다")

    trajectory_path = ROOT / "extras/course/data/scenarios/01-agent-trajectory.json"
    trajectory = read_json(trajectory_path, errors)
    if not isinstance(trajectory, dict):
        errors.append("1모듈 실행 궤적은 객체여야 합니다")
        return
    steps = trajectory.get("steps")
    if not isinstance(steps, list) or not steps:
        errors.append("1모듈 실행 궤적에 단계가 없습니다")
        return
    answers = [
        step for step in steps
        if isinstance(step, dict) and step.get("type") == "answer"
    ]
    if len(answers) != 1:
        errors.append("1모듈 실행 궤적에는 answer 단계가 정확히 하나여야 합니다")
    allowed_types = {"thought", "action", "observation", "answer"}
    for index, step in enumerate(steps):
        if not isinstance(step, dict):
            errors.append(f"실행 궤적 steps[{index}]는 객체여야 합니다")
            continue
        if step.get("type") not in allowed_types:
            errors.append(f"실행 궤적 steps[{index}]의 type이 올바르지 않습니다")
        iteration = step.get("iteration")
        if not isinstance(iteration, int) or iteration < 1:
            errors.append(f"실행 궤적 steps[{index}]의 iteration이 올바르지 않습니다")


def main() -> int:
    errors: list[str] = []
    for course_page in sorted(REQUIRED_COURSE_PAGES):
        require_file(course_page, "필수 코스 페이지", errors)
    validate_markdown_links(errors)

    manifest = read_json(MANIFEST_PATH, errors)
    if not isinstance(manifest, dict):
        errors.append("course-v1.json 최상위 값은 객체여야 합니다")
    else:
        for field in ("id", "title", "locale", "storage_key"):
            if not nonempty_string(manifest.get(field)):
                errors.append(f"manifest.{field}가 비어 있습니다")
        if manifest.get("version") != 1:
            errors.append("manifest.version은 1이어야 합니다")
        validate_overview(manifest, errors)
        validate_scenarios(manifest, errors)

        modules = manifest.get("modules")
        module_ids: set[str] = set()
        question_ids: set[str] = set()
        quiz_ids: set[str] = set()
        quiz_paths: set[str] = set()
        if not isinstance(modules, list):
            errors.append("manifest.modules는 배열이어야 합니다")
        else:
            if len(modules) != 6:
                errors.append("manifest.modules는 01~06의 여섯 모듈이어야 합니다")
            for index, module in enumerate(modules):
                validate_module(
                    module,
                    index,
                    module_ids,
                    question_ids,
                    quiz_ids,
                    quiz_paths,
                    errors,
                )
            if module_ids != EXPECTED_MODULE_IDS:
                missing = sorted(EXPECTED_MODULE_IDS - module_ids)
                extra = sorted(module_ids - EXPECTED_MODULE_IDS)
                if missing:
                    errors.append(f"누락 모듈 ID: {', '.join(missing)}")
                if extra:
                    errors.append(f"예상 밖 모듈 ID: {', '.join(extra)}")

        disk_quizzes = {
            relative(path)
            for path in (ROOT / "extras/course/data/quizzes").glob("*.json")
        }
        if disk_quizzes != quiz_paths:
            for orphan in sorted(disk_quizzes - quiz_paths):
                errors.append(f"manifest에 연결되지 않은 퀴즈: {orphan}")
            for missing in sorted(quiz_paths - disk_quizzes):
                errors.append(f"디스크에 없는 퀴즈: {missing}")

    if errors:
        print(f"입문 코스 검사 실패: {len(errors)}개", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("입문 코스 검사 통과")
    print("  - 개요 1개, 모듈 6개")
    print("  - 퀴즈 6개, 문항 24개")
    print("  - Mori Shop 시나리오와 실행 궤적")
    print("  - 페이지, 인터랙션 태그, 원문 링크")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

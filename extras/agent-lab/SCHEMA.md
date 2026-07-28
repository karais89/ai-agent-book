# 에이전트 궤적 JSON 스키마

궤적은 에이전트 실행 한 번을 기록한 것이다. `<agent-trajectory>` 웹 컴포넌트가 브라우저에서 ReAct 루프를 단계별로 재생할 때 사용한다.

이 스키마는 [`chapter1/web-search-agent/agent.py`](../../chapter1/web-search-agent/agent.py)의 `_emit(...)` 호출과 같은 구조이므로 실제 실행 결과를 거의 변환하지 않고 이 형식으로 내보낼 수 있다.

## 최상위 객체

```jsonc
{
  "$schema": "../SCHEMA.md",
  "experiment":  "ch1/web-search-agent",      // chapter/<exp>와 일치하는 안정적인 ID
  "title":       "GPT-5.6의 ‘아세안 10개국 수도 사이 최단 거리’ 풀이",
  "model":       "gpt-5.6-sol",
  "task":        "아세안 10개국의 수도 가운데 가장 가까운 두 수도 사이의 거리는 얼마인가?",
  "condition":   "full-context",              // 소거 조건, 선택 사항
  "outcome":     "success",                   // success | failure | loop | timeout
  "tags":        ["deep-research", "code-interp"],
  "recorded_at": "2026-07-20T14:32:08Z",
  "steps":       [ /* 아래 설명 참고 */ ]
}
```

## 단계 유형

모든 단계에는 1부터 시작하는 `iteration`과 `type`이 있다. 나머지 필드는 `type`에 따라 달라진다. 네 가지 유형은 ReAct의 사고(Reasoning), 행동(Acting), 관찰(Observing), 최종 답변(Answer)에 정확히 대응한다.

### `thought` — 모델의 내부 사고

```jsonc
{
  "iteration": 1,
  "type":      "thought",
  "content":   "먼저 아세안 10개국 수도를 찾고 각 수도 쌍의 거리를 확인해야 한다…"
}
```

`content`는 모델의 `reasoning_content` 필드(Kimi K3, GPT-5 Reasoning, Claude thinking 등)에서 가져온다. 내용이 길면 UI에서 접어서 표시한다.

### `action` — 모델의 도구 호출

```jsonc
{
  "iteration": 1,
  "type":      "action",
  "tool":      "$web_search",
  "args":      { "query": "아세안 ASEAN 10개국 수도 목록" }
}
```

`tool`은 도구 이름이고 `args`는 파싱된 인수 객체다.

### `observation` — 도구가 반환한 결과

```jsonc
{
  "iteration": 1,
  "type":      "observation",
  "tool":      "$web_search",
  "content":   "아세안 10개국 수도: 자카르타, 방콕, 쿠알라룸푸르, 싱가포르, 마닐라…"
}
```

검색 결과나 코드 출력처럼 내용이 길면 UI가 축약된 내용을 표시하고 ‘펼치기’ 토글을 제공한다.

### `answer` — 사용자에게 보여 주는 최종 답변

```jsonc
{
  "iteration": 3,
  "type":      "answer",
  "content":   "가장 가까운 두 수도는 싱가포르와 쿠알라룸푸르이며 거리는 약 316km입니다."
}
```

궤적마다 `answer` 단계는 하나뿐이며 이 단계에서 재생이 끝난다.

## 규칙

- **반복 카운터**는 단계 인덱스가 아니라 1부터 시작하는 LLM 호출 인덱스다. 한 번의 반복에서 사고 + 행동 + 관찰의 세 단계가 나올 수 있다.
- **개인 식별 정보와 API 키를 넣지 않는다.** 궤적은 저장소에 커밋되고 정적으로 제공되므로 기록하기 전에 민감한 정보를 모두 제거해야 한다.
- **대표성을 유지한다.** 불필요하게 장황한 중간 사고는 줄일 수 있지만 실제 도구 호출과 결과는 수정하지 않는다. 성공과 결함을 모두 포함한 실제 모델 행동을 보여 주는 데 가치가 있다.

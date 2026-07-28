# AI 에이전트 깊이 이해하기: 설계 원리와 엔지니어링 실무

[![PDF](https://img.shields.io/badge/PDF-다운로드-success.svg)](#-전자책) [![온라인 읽기](https://img.shields.io/badge/🌐_온라인_읽기-karais89.github.io-success?style=flat-square)](https://karais89.github.io/ai-agent-book/) [![별](https://img.shields.io/github/stars/karais89/ai-agent-book?style=social)](https://github.com/karais89/ai-agent-book) [![라이선스](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE) [![언어](https://img.shields.io/badge/languages-한국어%20%7C%20English-informational.svg)](#-전자책)

**한국어 ← 현재 · [English](docs/en/README.md)**

> 📥 **[PDF / EPUB 다운로드](#-전자책)**를 권장한다. 오프라인 판본의 조판이 가장 좋으며, 언어 전환·접이식 장 목록·전체 검색을 제공하는 [온라인 판본](https://karais89.github.io/ai-agent-book/)도 이용할 수 있다.

**에이전트 = LLM + 컨텍스트 + 도구** — 이 책은 이 핵심 공식을 중심으로 AI 에이전트의 원리부터 엔지니어링 실무까지 10개 장으로 설명한다. 본문, 그림, **93개 실습**을 모두 오픈 소스로 공개한다.

| 📚 기초부터 프로덕션까지 **본문 10장** | 📂 **실습 프로젝트 93개**(70개 이상 독립 실행) | 🌐 **한국어와 영어** |
| :---: | :---: | :---: |

## 📖 전자책

> 📥 **오프라인 다운로드**(권장, 전체 본문, 무료 오픈 소스). 아래 링크는 `main` 브랜치의 최신 자동 빌드를 가리키며, 고정 버전은 [Releases](https://github.com/karais89/ai-agent-book/releases)에서 확인할 수 있다.
>
> - **한국어**: [PDF](https://github.com/karais89/ai-agent-book/releases/download/latest/AI-Agents-in-Depth-ko.pdf) · [EPUB](https://github.com/karais89/ai-agent-book/releases/download/latest/AI-Agents-in-Depth-ko.epub)
> - **English**: [PDF](https://github.com/karais89/ai-agent-book/releases/download/latest/AI-Agents-in-Depth-en.pdf) · [EPUB](https://github.com/karais89/ai-agent-book/releases/download/latest/AI-Agents-in-Depth-en.epub)
>
> 🌐 [온라인으로 읽기](https://karais89.github.io/ai-agent-book/) — 한국어·영어 전환, 접이식 장 목록, 전체 검색, 실습 바로가기를 지원하며 `main` 브랜치가 갱신될 때마다 자동으로 다시 빌드된다.

한국어 본문 원본은 [`book/`](book/), 영어판은 [`book-en/`](book-en/)에 있다. 통합 빌드 스크립트로 두 언어의 EPUB 3 형식 전자책을 만들 수 있으며 자세한 방법은 [EPUB 빌드 안내](EPUB.md)를 참고한다.

<details>
<summary><b>🔧 PDF를 직접 빌드하려면?</b> (pandoc / xelatex / ElegantBook 필요)</summary>

- **본문 원본**: `book/introduction.md`, `book/chapter1.md`~`book/chapter10.md`, `book/afterword.md`, `book/reference-answers.md`
- **빌드**: Pandoc, XeLaTeX, ElegantBook 문서 클래스, 한국어 글꼴을 설치한 뒤 실행한다.

  ```bash
  cd book && bash build_pdf.sh
  ```

  그림은 `book/images/`의 SVG 파일을 직접 사용한다. 조판 세부 설정은 `book/preamble.tex`과 `book/*.lua`에 있다.

</details>

## 📑 내용 미리보기

책 전체는 **에이전트 = LLM + 컨텍스트 + 도구**라는 공식을 중심으로 단계적으로 전개된다.

| 장 | 주제 | 한 줄 핵심 | 본문 | 코드 |
| :--: | --- | --- | :--: | :--: |
| 1 | 🚀 **AI 에이전트 기초** | **에이전트 = LLM + 컨텍스트 + 도구** · 진짜 경쟁력은 하네스 엔지니어링 | [읽기](book/chapter1.md) | [4](chapter1/README.md) |
| 2 | 🎯 **컨텍스트 엔지니어링** | 능력의 상한을 정하는 컨텍스트: KV 캐시, 프롬프트 엔지니어링, 에이전트 스킬, 컨텍스트 압축 | [읽기](book/chapter2.md) | [9](chapter2/README.md) |
| 3 | 📚 **사용자 메모리와 지식 베이스** | 세션을 넘어 사용자를 기억하고 외부 지식을 연결하는 사용자 메모리, RAG, 구조화 인덱스, 지식 그래프 | [읽기](book/chapter3.md) | [13](chapter3/README.md) |
| 4 | 🛠️ **도구** | 에이전트의 손발인 도구: MCP, 인식·실행·협업 도구, 이벤트 기반 비동기 에이전트, 선제적 도구 탐색 | [읽기](book/chapter4.md) | [7](chapter4/README.md) |
| 5 | 💻 **코딩 에이전트와 코드 생성** | 새 도구를 만드는 도구인 코드 · 프로덕션급 코딩 에이전트의 전체 구조 | [읽기](book/chapter5.md) | [12](chapter5/README.md) |
| 6 | 🎯 **에이전트 평가** | 성능을 비교 가능한 신호로 바꾸는 평가 환경, 지표, 통계적 유의성, 평가 기반 모델 선택 | [읽기](book/chapter6.md) | [12](chapter6/README.md) |
| 7 | 🧠 **모델 사후 학습** | 사전 학습·SFT·RL의 세 단계, SFT와 RL의 선택, 도구 호출 내재화, 샘플 효율성 | [읽기](book/chapter7.md) | [16](chapter7/README.md) |
| 8 | 🔄 **에이전트의 지속적 진화** | 실행 궤적에서 학습 신호를 얻어 지식, 지침, 프로그램, 매개변수를 갱신 | [읽기](book/chapter8.md) | [6](chapter8/README.md) |
| 9 | 🎙️ **멀티모달과 실시간 상호작용** | 텍스트에서 음성·GUI·물리 세계로 확장하는 세 가지 음성 패러다임, 컴퓨터 사용(Computer Use), 로봇 | [읽기](book/chapter9.md) | [7](chapter9/README.md) |
| 10 | 🤝 **멀티 에이전트 협업** | 개인을 넘어서는 집단 지능: 협업 프레임워크, 컨텍스트 공유와 격리, 에이전트 사회 | [읽기](book/chapter10.md) | [7](chapter10/README.md) |

> 💡 **읽기**는 GitHub에서 장 본문을 바로 여는 링크이고, 숫자는 해당 장의 실습 프로젝트 수다. 프로젝트 유형(✅ 독립 실행 / 📖 재현 / 🚧 설계)은 각 장 README에서 설명한다.
>
> 📚 효율적인 학습 경로는 **[학습 가이드](docs/ko/LEARNING.md)**에서 확인할 수 있다.

## 🔑 API 키

실습을 위해 아래 플랫폼의 API 키를 준비할 수 있다. 모델 선택은 [이 가이드](https://01.me/2025/07/llm-api-setup/)를 참고한다.

| 플랫폼 | 링크 | 특징 | 접속 지역 |
| --- | --- | --- | --- |
| **Kimi**(Moonshot) | <https://platform.moonshot.cn/> | 코딩과 에이전트 기능이 강한 Kimi 계열 | 중국 본토 |
| **Zhipu GLM** | <https://open.bigmodel.cn/> | 코딩과 에이전트 기능이 강한 GLM 계열 | 중국 본토 |
| **SiliconFlow** | <https://siliconflow.cn/> | DeepSeek, Qwen 등 다양한 오픈 소스 모델 | 중국 본토 |
| **DeepSeek** | <https://platform.deepseek.com/> | DeepSeek 공식 API | 전 세계 + 중국 본토 |
| **Krill AI** | [www.krill-ai.com](https://www.krill-ai.com/register?invite=Q8D3L35725) | OpenAI, Claude, Gemini, Grok, Kimi, GLM, DeepSeek, Qwen, MiniMax 통합 접근 | 전 세계 + 중국 본토 |
| **OpenRouter** | <https://openrouter.ai/> | 주요 상용·오픈 소스 모델 통합 접근 | 전 세계 |

## 💎 후원

이 프로젝트를 후원한 **Krill AI**에 감사한다. Krill은 GPT, Claude, Gemini와 여러 중국 모델을 위한 안정적인 API 릴레이를 제공하며 기업 맞춤 지원, 청구서 발행, 전담 기술 지원, WebSocket 연결을 지원한다.

이 책의 독자는 [이 링크](https://www.krill-ai.com/register?invite=Q8D3L35725)로 가입하고 충전할 때 프로모션 코드 `ai-agent-book`을 입력하면 첫 Codex 요금제 구매 시 23% 할인을 받을 수 있다.

## 📦 부록 · 외부 저장소 받기

6·7·9·10장의 평가 벤치마크, 학습 프레임워크, 로봇 플랫폼 등 외부 저장소 19개는 크기와 라이선스 문제로 포함하지 않았다. 필요한 저장소를 해당 디렉터리에 직접 복제한다.

### 한 번에 복제하기

<details>
<summary><b>🔧 복제 명령 펼치기</b> (외부 저장소 19개)</summary>

```bash
# 6장 · 평가 벤치마크
git clone https://github.com/google-research/android_world.git         chapter6/android_world
git clone https://huggingface.co/datasets/gaia-benchmark/GAIA          chapter6/GAIA
git clone https://github.com/xlang-ai/OSWorld.git                      chapter6/OSWorld
git clone https://github.com/SWE-bench/SWE-bench.git                   chapter6/SWE-bench
git clone https://github.com/sierra-research/tau2-bench.git            chapter6/tau2-bench
git clone https://github.com/laude-institute/terminal-bench.git        chapter6/terminal-bench

# 7장 · 학습 프레임워크(bojieli/*는 이 책에 맞춘 포크)
git clone https://github.com/bojieli/minimind.git                      chapter7/MiniMind-pretrain/minimind
git clone https://github.com/bojieli/minimind-v.git                    chapter7/MiniMind-pretrain/minimind-v
git clone https://github.com/bojieli/AdaptThink.git                    chapter7/AdaptThink-original
git clone https://github.com/bojieli/AWorld.git                        chapter7/AWorld
git clone https://github.com/bojieli/SFTvsRL.git                       chapter7/SFTvsRL
git clone https://github.com/bojieli/verl.git                          chapter7/verl
git clone https://github.com/thinking-machines-lab/tinker-cookbook.git chapter7/tinker-cookbook
git clone https://github.com/19PINE-AI/rlvp.git                        chapter7/RLVP/rlvp
git clone https://github.com/PRIME-RL/SimpleVLA-RL.git                 chapter7/SimpleVLA-RL/SimpleVLA-RL

# 9장 · 브라우저 자동화와 Claude 예제
git clone https://github.com/browser-use/browser-use.git               chapter9/browser-use
git clone https://github.com/anthropics/claude-quickstarts.git         chapter9/claude-quickstarts

# 10장 · 전화+컴퓨터 이중 에이전트와 Stanford AI Town
git clone https://github.com/19PINE-AI/TalkAct.git                     chapter10/use-computer-while-calling
git clone https://github.com/joonspk-research/generative_agents.git    chapter10/generative_agents
```

> 각 프로젝트 README가 특정 커밋을 지정하면 재현성을 위해 해당 버전으로 `git checkout`한다. 10장의 `use-computer-while-calling`은 독립 프로젝트 [19PINE-AI/TalkAct](https://github.com/19PINE-AI/TalkAct)로 발전했으므로 위 명령으로 받는다.

</details>

### 다른 재현 방법

| 실습 | 유형 | 설명 |
| --- | :--: | --- |
| 6-2 / 6-3 / 6-4 / 6-9 | 📝 독자 실습 | 사람 기반 벤치마크, 메모리 평가, JSON Cards와 RAG 비교, 메모리 선택 — 3장의 `user-memory`, `user-memory-evaluation`, `contextual-retrieval`을 변형해 사용 |
| 5-12 | 📝 독자 실습 | 에이전트를 만드는 에이전트 — `chapter5/coding-agent`를 기반으로 확장 |
| 7-8 | 📝 독자 실습 | 프롬프트 증류 — `chapter8/prompt-distillation` 구현 참고 |
| 7-9 | 📝 독자 실습 | CoT 증류 `[확장]` — `chapter7/cot-distillation`의 SFT 데이터 생성기와 규칙 검증기 참고 |
| 6-11 | 🤖 시뮬레이션 평가 | OpenVLA + RoboTwin2 — VLA 학습과 환경 의존성은 `chapter7/SimpleVLA-RL` README 참고 |
| 9-8 / 9-9 | 🔧 실제 하드웨어 | XLeRobot 원격 조작과 LLM 에이전트 제어 — SO-100 로봇 팔 필요, [Teleop](https://xlerobot.readthedocs.io/en/latest/software/getting_started/XLeRobot_teleop.html) · [LLM Agent](https://xlerobot.readthedocs.io/en/latest/software/getting_started/LLM_agent.html) |
| 9-10 | 🔧 실제 하드웨어 | RGB 제로샷 Sim2Real 파지 — [`StoneT2000/lerobot-sim2real`](https://github.com/StoneT2000/lerobot-sim2real), 시뮬레이션은 GPU만으로 실행 가능하며 배포에는 SO-100 필요 |

## 🤝 기여

책과 실습 코드는 모두 오픈 소스다. 다음과 같은 풀 리퀘스트를 환영한다.

| 유형 | 설명 |
| --- | --- |
| 📝 **책 내용 개선** | 오탈자 수정, 보충 설명, 더 명확한 표현, 최신 동향 추가 |
| 🐛 **코드 개선과 버그 수정** | 실습을 더 견고하고 쓰기 쉬우며 프로덕션에 가깝게 개선 |
| 🧪 **새 실습 프로젝트** | 더 나은 구현으로 교체하거나 새로운 예제 추가 |
| 🎨 **그림 개선** | `book/images/`의 SVG 도표를 더 명확하게 개선 |

제출 전 관련 실습을 직접 실행해 재현되는지 확인하고, 필요하면 먼저 이슈에서 아이디어를 논의한다.

## 📄 라이선스

이 프로젝트는 [Apache License 2.0](LICENSE)으로 공개한다. 일부 하위 프로젝트에는 별도 라이선스가 있을 수 있으므로 각 프로젝트의 안내를 따른다.

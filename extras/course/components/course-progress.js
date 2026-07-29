/**
 * <course-progress data-view="dashboard|completion">
 *
 * Displays course progress from ai-agent-book.course.v1. Module metadata is
 * loaded from extras/course/data/course-v1.json, with a built-in fallback so
 * progress remains usable if the manifest cannot be fetched.
 */
(function () {
  "use strict";

  if (!window.customElements || customElements.get("course-progress")) return;

  var STORAGE_KEY = "ai-agent-book.course.v1";
  var READY_EVENT = "ai-agent-course:ready";
  var PROGRESS_EVENT = "ai-agent-course:progress";

  var DEFAULT_MODULES = [
    {
      id: "00-overview",
      title: "10분 핵심 개요",
      path: "00-overview/",
      required: false,
    },
    {
      id: "01-agent",
      title: "1모듈 · 에이전트와 실행 루프",
      path: "01-agent/",
      required: true,
    },
    {
      id: "02-context",
      title: "2모듈 · 올바른 컨텍스트",
      path: "02-context/",
      required: true,
    },
    {
      id: "03-tools",
      title: "3모듈 · 안전하고 이해하기 쉬운 도구",
      path: "03-tools/",
      required: true,
    },
    {
      id: "04-harness",
      title: "4모듈 · 데모를 안전한 시스템으로 바꾸기",
      path: "04-harness/",
      required: true,
    },
    {
      id: "05-evaluation",
      title: "5모듈 · 평가 없이는 개선도 없다",
      path: "05-evaluation/",
      required: true,
    },
    {
      id: "06-improvement",
      title: "6모듈 · 운영 경험으로 개선하기",
      path: "06-improvement/",
      required: true,
    },
  ];

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function uniqueStrings(value) {
    return Array.isArray(value)
      ? value
          .map(function (item) {
            return cleanString(item);
          })
          .filter(function (item, index, all) {
            return item && all.indexOf(item) === index;
          })
      : [];
  }

  function defaultState() {
    return {
      completedModules: [],
      visitedModules: [],
      lastModule: null,
      quizzes: {},
    };
  }

  function normalizeState(value) {
    var source = value && typeof value === "object" ? value : {};
    return {
      completedModules: uniqueStrings(
        source.completedModules || source.completed_modules
      ),
      visitedModules: uniqueStrings(
        source.visitedModules || source.visited_modules
      ),
      lastModule:
        cleanString(source.lastModule || source.last_module) || null,
      quizzes:
        source.quizzes &&
        typeof source.quizzes === "object" &&
        !Array.isArray(source.quizzes)
          ? source.quizzes
          : {},
    };
  }

  function normalizeModule(module, index) {
    var source =
      typeof module === "string"
        ? { id: module, title: module }
        : module && typeof module === "object"
          ? module
          : {};
    var id = cleanString(
      source.id || source.module_id || source.moduleId || source.slug
    );
    if (!id) return null;
    var required =
      source.required === false || source.optional === true
        ? false
        : id !== "00-overview";
    return {
      id: id,
      title:
        cleanString(source.title || source.label || source.name) ||
        "모듈 " + (index + 1),
      path: cleanString(source.href || source.path || source.url) || id + "/",
      required: required,
      quizId: cleanString(source.quiz_id || source.quizId || source.quiz),
    };
  }

  function modulesFromManifest(data) {
    var source = data && typeof data === "object" ? data : {};
    var raw = Array.isArray(source.modules)
      ? source.modules
      : Array.isArray(source.lessons)
        ? source.lessons
        : source.course && Array.isArray(source.course.modules)
          ? source.course.modules
          : [];
    return raw.map(normalizeModule).filter(Boolean);
  }

  function deriveCourseAssetBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var src = scripts[i].getAttribute("src");
      if (!src || src.indexOf("extras/course/") === -1) continue;
      try {
        var url = new URL(src, document.baseURI);
        var marker = "/extras/course/";
        var index = url.pathname.lastIndexOf(marker);
        if (index === -1) continue;
        url.pathname = url.pathname.slice(0, index + marker.length);
        url.search = "";
        url.hash = "";
        return url;
      } catch (_) {
        // Continue looking for another course script.
      }
    }

    var fallback = new URL(document.baseURI);
    var courseIndex = fallback.pathname.indexOf("/course/");
    if (courseIndex !== -1) {
      fallback.pathname =
        fallback.pathname.slice(0, courseIndex + 1) + "extras/course/";
    } else {
      fallback.pathname = fallback.pathname.replace(/[^/]*$/, "") + "extras/course/";
    }
    fallback.search = "";
    fallback.hash = "";
    return fallback;
  }

  function fallbackCourseUrl(moduleOrPath) {
    var assetBase = deriveCourseAssetBase();
    var root = new URL("../../", assetBase);
    var value = cleanString(moduleOrPath);
    if (!value) return new URL("course/", root).href;
    if (/^(?:https?:)?\/\//i.test(value) || value.charAt(0) === "#") {
      return value;
    }
    if (value.charAt(0) === "/") {
      return new URL(value.replace(/^\/+/, ""), root).href;
    }
    if (/^(?:course|book|book-en|chapter\d+)\//.test(value)) {
      return new URL(value, root).href;
    }
    return new URL("course/" + value.replace(/^\.?\//, ""), root).href;
  }

  function staticStyles() {
    return [
      ":host {",
      "  display: block;",
      "  margin: 1.5rem 0;",
      "  color: var(--md-typeset-color, #1f2328);",
      "  font: inherit;",
      "  line-height: 1.6;",
      "  color-scheme: light dark;",
      "}",
      ".panel {",
      "  border: 1px solid var(--md-default-fg-color--lightest, #d8dee4);",
      "  border-radius: .65rem;",
      "  padding: clamp(1rem, 3vw, 1.5rem);",
      "  background: var(--md-default-bg-color, #fff);",
      "}",
      "h2 { margin: 0 0 .3rem; font-size: 1.25rem; line-height: 1.4; }",
      "p { margin: .35rem 0; }",
      ".muted { color: var(--md-default-fg-color--light, #57606a); }",
      ".meter {",
      "  display: grid;",
      "  grid-template-columns: minmax(0, 1fr) auto;",
      "  gap: .5rem .75rem;",
      "  align-items: center;",
      "  margin: 1rem 0;",
      "}",
      "progress {",
      "  width: 100%;",
      "  height: .75rem;",
      "  accent-color: var(--md-primary-fg-color, #5e35b1);",
      "}",
      ".percent { font-weight: 700; font-variant-numeric: tabular-nums; }",
      ".module-list {",
      "  display: grid;",
      "  gap: .6rem;",
      "  margin: 1rem 0;",
      "  padding: 0;",
      "  list-style: none;",
      "}",
      ".module {",
      "  display: grid;",
      "  grid-template-columns: minmax(0, 1fr) auto;",
      "  gap: .35rem 1rem;",
      "  align-items: center;",
      "  padding: .75rem .85rem;",
      "  border: 1px solid var(--md-default-fg-color--lightest, #d8dee4);",
      "  border-radius: .45rem;",
      "}",
      ".module[data-complete='true'] {",
      "  border-inline-start: .25rem solid #2e7d32;",
      "}",
      ".module a {",
      "  min-width: 0;",
      "  color: var(--md-typeset-a-color, #5e35b1);",
      "  font-weight: 650;",
      "  overflow-wrap: anywhere;",
      "}",
      ".status {",
      "  white-space: nowrap;",
      "  font-size: .8rem;",
      "  font-weight: 700;",
      "}",
      ".module[data-complete='true'] .status { color: #2e7d32; }",
      ".module[data-complete='false'] .status {",
      "  color: var(--md-default-fg-color--light, #57606a);",
      "}",
      ".score {",
      "  grid-column: 1 / -1;",
      "  margin: 0;",
      "  color: var(--md-default-fg-color--light, #57606a);",
      "  font-size: .8rem;",
      "}",
      ".actions {",
      "  display: flex;",
      "  flex-wrap: wrap;",
      "  gap: .65rem;",
      "  align-items: center;",
      "  margin-top: 1rem;",
      "}",
      ".primary, button {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  min-height: 2.35rem;",
      "  border-radius: .35rem;",
      "  padding: .55rem .85rem;",
      "  font: inherit;",
      "  font-weight: 700;",
      "  text-decoration: none;",
      "  cursor: pointer;",
      "}",
      ".primary {",
      "  border: 1px solid var(--md-primary-fg-color, #5e35b1);",
      "  background: var(--md-primary-fg-color, #5e35b1);",
      "  color: var(--md-primary-bg-color, #fff);",
      "}",
      "button {",
      "  border: 1px solid var(--md-default-fg-color--lightest, #d8dee4);",
      "  background: transparent;",
      "  color: var(--md-typeset-color, #1f2328);",
      "}",
      "a:focus-visible, button:focus-visible {",
      "  outline: .18rem solid var(--md-accent-fg-color, #7c4dff);",
      "  outline-offset: .15rem;",
      "}",
      ".loading {",
      "  margin: 0;",
      "  padding: .8rem;",
      "  border-radius: .35rem;",
      "  background: var(--md-code-bg-color, #f6f8fa);",
      "}",
      ".complete-mark {",
      "  width: 2.4rem;",
      "  height: 2.4rem;",
      "  display: grid;",
      "  place-items: center;",
      "  margin-bottom: .7rem;",
      "  border-radius: 50%;",
      "  background: #2e7d32;",
      "  color: #fff;",
      "  font-weight: 800;",
      "}",
      "@media (max-width: 30rem) {",
      "  .panel { padding: .85rem; }",
      "  .module { grid-template-columns: minmax(0, 1fr); }",
      "  .status { white-space: normal; }",
      "  .primary, button { width: 100%; box-sizing: border-box; }",
      "}",
    ].join("\n");
  }

  class CourseProgress extends HTMLElement {
    static get observedAttributes() {
      return ["data-view", "data-src", "data-modules"];
    }

    constructor() {
      super();
      this._modules = DEFAULT_MODULES.map(function (module) {
        return Object.assign({}, module);
      });
      this._connected = false;
      this._abortController = null;
      this._loadToken = 0;
      this._onProgress = this._render.bind(this);
      this._onReady = this._handleReady.bind(this);
      this._onStorage = this._handleStorage.bind(this);
      this.attachShadow({ mode: "open" });
      var style = document.createElement("style");
      style.textContent = staticStyles();
      this.shadowRoot.appendChild(style);
      this._mount = element("section", "panel");
      this._mount.setAttribute("aria-live", "polite");
      this._mount.setAttribute("aria-atomic", "false");
      this.shadowRoot.appendChild(this._mount);
    }

    connectedCallback() {
      if (!this._connected) {
        window.addEventListener(PROGRESS_EVENT, this._onProgress);
        window.addEventListener(READY_EVENT, this._onReady);
        window.addEventListener("storage", this._onStorage);
        this._connected = true;
      }
      this._loadModules();
    }

    disconnectedCallback() {
      if (this._connected) {
        window.removeEventListener(PROGRESS_EVENT, this._onProgress);
        window.removeEventListener(READY_EVENT, this._onReady);
        window.removeEventListener("storage", this._onStorage);
        this._connected = false;
      }
      if (this._abortController) this._abortController.abort();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue && this.isConnected) {
        if (name === "data-view") this._render();
        else this._loadModules();
      }
    }

    _api() {
      return window.AIAgentCourse || null;
    }

    _view() {
      return cleanString(
        this.getAttribute("data-view") || this.getAttribute("view")
      ).toLowerCase() === "completion"
        ? "completion"
        : "dashboard";
    }

    _state() {
      var api = this._api();
      if (api && typeof api.getState === "function") {
        return normalizeState(api.getState());
      }
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? normalizeState(JSON.parse(raw)) : defaultState();
      } catch (_) {
        return defaultState();
      }
    }

    _handleReady() {
      this._render();
    }

    _handleStorage(event) {
      if (event.key === STORAGE_KEY) this._render();
    }

    _inlineModules() {
      var raw = cleanString(this.getAttribute("data-modules"));
      if (!raw) return [];
      try {
        var parsed = JSON.parse(raw);
        var values = Array.isArray(parsed)
          ? parsed
          : parsed && Array.isArray(parsed.modules)
            ? parsed.modules
            : [];
        return values.map(normalizeModule).filter(Boolean);
      } catch (_) {
        return raw
          .split(",")
          .map(function (id, index) {
            return normalizeModule(cleanString(id), index);
          })
          .filter(Boolean);
      }
    }

    _manifestUrl() {
      var explicit = cleanString(
        this.getAttribute("data-src") || this.getAttribute("src")
      );
      var api = this._api();
      if (explicit) {
        if (api && /^\/?extras\/course\//.test(explicit)) {
          return api.assetUrl(explicit.replace(/^\/?extras\/course\//, ""));
        }
        return new URL(explicit, document.baseURI).href;
      }
      if (api && typeof api.assetUrl === "function") {
        return api.assetUrl("data/course-v1.json");
      }
      return new URL("data/course-v1.json", deriveCourseAssetBase()).href;
    }

    async _loadModules() {
      var inline = this._inlineModules();
      if (inline.length) {
        this._modules = inline;
        this._render();
        return;
      }

      this._loadToken += 1;
      var token = this._loadToken;
      if (this._abortController) this._abortController.abort();
      this._abortController =
        typeof AbortController === "function" ? new AbortController() : null;
      this._renderLoading();

      try {
        var response = await fetch(this._manifestUrl(), {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: this._abortController ? this._abortController.signal : undefined,
        });
        if (!response.ok) throw new Error("HTTP " + response.status);
        var data = await response.json();
        if (token !== this._loadToken || !this.isConnected) return;
        var modules = modulesFromManifest(data);
        this._modules = modules.length
          ? modules
          : DEFAULT_MODULES.map(function (module) {
              return Object.assign({}, module);
            });
        this._render();
      } catch (error) {
        if (error && error.name === "AbortError") return;
        if (token !== this._loadToken || !this.isConnected) return;
        this._modules = DEFAULT_MODULES.map(function (module) {
          return Object.assign({}, module);
        });
        this._render();
      }
    }

    _clearMount() {
      while (this._mount.firstChild) this._mount.removeChild(this._mount.firstChild);
    }

    _renderLoading() {
      this._clearMount();
      this._mount.setAttribute("aria-busy", "true");
      var loading = element("p", "loading", "학습 진도를 불러오는 중입니다…");
      loading.setAttribute("role", "status");
      this._mount.appendChild(loading);
    }

    _render() {
      if (!this._mount) return;
      this._clearMount();
      this._mount.setAttribute("aria-busy", "false");
      var state = this._state();
      if (this._view() === "completion") {
        this._renderCompletion(state);
      } else {
        this._renderDashboard(state);
      }
    }

    _requiredModules() {
      var required = this._modules.filter(function (module) {
        return module.required;
      });
      return required.length ? required : this._modules.slice();
    }

    _progress(state) {
      var required = this._requiredModules();
      var complete = required.filter(function (module) {
        return state.completedModules.indexOf(module.id) !== -1;
      });
      return {
        required: required,
        complete: complete,
        percent: required.length
          ? Math.round((complete.length / required.length) * 100)
          : 0,
      };
    }

    _moduleUrl(module) {
      var api = this._api();
      var value = module.path || module.id;
      return api && typeof api.courseUrl === "function"
        ? api.courseUrl(value)
        : fallbackCourseUrl(value);
    }

    _recordForModule(state, module) {
      var records = Object.keys(state.quizzes)
        .map(function (quizId) {
          return {
            id: quizId,
            value: state.quizzes[quizId] || {},
          };
        })
        .filter(function (record) {
          var moduleId = cleanString(
            record.value.moduleId || record.value.module_id
          );
          return (
            moduleId === module.id ||
            (module.quizId && record.id === module.quizId)
          );
        });
      if (!records.length) return null;
      return {
        highestScore: Math.max.apply(
          null,
          records.map(function (record) {
            return Number(
              record.value.highestScore !== undefined
                ? record.value.highestScore
                : record.value.highest_score
            ) || 0;
          })
        ),
        attempts: records.reduce(function (sum, record) {
          var attempts = Number(record.value.attempts);
          return sum + (Number.isFinite(attempts) ? attempts : 0);
        }, 0),
      };
    }

    _resumeModule(state) {
      var last = this._modules.find(function (module) {
        return module.id === state.lastModule;
      });
      if (last && state.completedModules.indexOf(last.id) === -1) return last;
      return (
        this._requiredModules().find(function (module) {
          return state.completedModules.indexOf(module.id) === -1;
        }) ||
        last ||
        this._modules[0] ||
        null
      );
    }

    _appendMeter(state) {
      var progress = this._progress(state);
      var meter = element("div", "meter");
      var bar = document.createElement("progress");
      bar.max = progress.required.length || 1;
      bar.value = progress.complete.length;
      bar.setAttribute(
        "aria-label",
        "필수 모듈 " +
          progress.required.length +
          "개 중 " +
          progress.complete.length +
          "개 완료"
      );
      var percent = element("span", "percent", progress.percent + "%");
      meter.appendChild(bar);
      meter.appendChild(percent);
      this._mount.appendChild(meter);
      return progress;
    }

    _appendModuleList(state, modules) {
      var list = element("ol", "module-list");
      for (var i = 0; i < modules.length; i += 1) {
        var module = modules[i];
        var isComplete = state.completedModules.indexOf(module.id) !== -1;
        var item = element("li", "module");
        item.setAttribute("data-complete", String(isComplete));

        var link = element("a", "", module.title);
        link.href = this._moduleUrl(module);
        var status = element(
          "span",
          "status",
          isComplete
            ? "완료"
            : module.required
              ? "미완료"
              : state.visitedModules.indexOf(module.id) !== -1
                ? "방문함"
                : "선택"
        );
        item.appendChild(link);
        item.appendChild(status);

        var record = this._recordForModule(state, module);
        if (record && record.attempts) {
          item.appendChild(
            element(
              "p",
              "score",
              "퀴즈 최고 " +
                record.highestScore +
                "점 · " +
                record.attempts +
                "회 시도"
            )
          );
        }
        list.appendChild(item);
      }
      this._mount.appendChild(list);
    }

    _appendResetButton() {
      var api = this._api();
      if (!api || typeof api.resetProgress !== "function") return null;
      var button = element("button", "", "진도 초기화");
      button.type = "button";
      button.addEventListener("click", function () {
        if (
          window.confirm(
            "이 브라우저에 저장된 입문 코스 진도와 퀴즈 기록을 모두 지울까요?"
          )
        ) {
          api.resetProgress();
        }
      });
      return button;
    }

    _renderDashboard(state) {
      this._mount.appendChild(element("h2", "", "입문 코스 진도"));
      this._mount.appendChild(
        element(
          "p",
          "muted",
          "진도와 퀴즈 기록은 현재 브라우저에만 저장됩니다."
        )
      );
      var progress = this._appendMeter(state);
      this._appendModuleList(state, this._modules);

      var actions = element("div", "actions");
      var resume = this._resumeModule(state);
      if (resume) {
        var resumeLink = element(
          "a",
          "primary",
          progress.percent === 100 ? "완료 결과 보기" : "이어서 학습"
        );
        resumeLink.href =
          progress.percent === 100
            ? fallbackCourseUrl("completion/")
            : this._moduleUrl(resume);
        actions.appendChild(resumeLink);
      }
      var reset = this._appendResetButton();
      if (reset) actions.appendChild(reset);
      this._mount.appendChild(actions);
    }

    _renderCompletion(state) {
      var progress = this._progress(state);
      var isComplete =
        progress.required.length > 0 &&
        progress.complete.length === progress.required.length;

      if (isComplete) {
        var mark = element("div", "complete-mark", "✓");
        mark.setAttribute("aria-hidden", "true");
        this._mount.appendChild(mark);
        this._mount.appendChild(element("h2", "", "입문 코스를 완주했습니다"));
        this._mount.appendChild(
          element(
            "p",
            "",
            "필수 모듈 " +
              progress.required.length +
              "개를 모두 완료했습니다. 이제 원문과 실험으로 관심 주제를 더 깊게 탐구해 보세요."
          )
        );
      } else {
        this._mount.appendChild(element("h2", "", "아직 완주 전입니다"));
        this._mount.appendChild(
          element(
            "p",
            "",
            "필수 모듈 " +
              progress.required.length +
              "개 중 " +
              progress.complete.length +
              "개를 완료했습니다."
          )
        );
      }

      this._appendMeter(state);
      var unfinished = progress.required.filter(function (module) {
        return state.completedModules.indexOf(module.id) === -1;
      });
      if (unfinished.length) {
        this._mount.appendChild(element("p", "muted", "남은 모듈"));
        this._appendModuleList(state, unfinished);
      }

      var actions = element("div", "actions");
      if (unfinished.length) {
        var continueLink = element("a", "primary", "학습 계속하기");
        continueLink.href = this._moduleUrl(
          this._resumeModule(state) || unfinished[0]
        );
        actions.appendChild(continueLink);
      } else {
        var readingLink = element("a", "primary", "전체 원문으로 이동");
        readingLink.href = fallbackCourseUrl("book/chapter1/");
        actions.appendChild(readingLink);
      }
      var dashboardLink = element("a", "", "과정 대시보드");
      dashboardLink.href = fallbackCourseUrl("course/");
      actions.appendChild(dashboardLink);
      this._mount.appendChild(actions);
    }
  }

  customElements.define("course-progress", CourseProgress);
})();

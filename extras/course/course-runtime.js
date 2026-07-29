/**
 * Shared runtime for the beginner course.
 *
 * It owns local progress, resolves assets under a GitHub Pages sub-path, and
 * enhances course controls after both full loads and Material instant
 * navigation. Components communicate through window.AIAgentCourse and the
 * "ai-agent-course:progress" event.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "ai-agent-book.course.v1";
  var EVENT_READY = "ai-agent-course:ready";
  var EVENT_PROGRESS = "ai-agent-course:progress";
  var RUNTIME_VERSION = 1;

  var previousApi = window.AIAgentCourse;
  if (previousApi && previousApi.runtimeVersion === RUNTIME_VERSION) {
    previousApi.init();
    return;
  }

  var memoryState = createDefaultState();
  var assetBase = deriveAssetBase();

  function createDefaultState() {
    return {
      schemaVersion: 1,
      visitedModules: [],
      completedModules: [],
      lastModule: null,
      quizzes: {},
      projectCheckpoints: {},
      updatedAt: null,
    };
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function uniqueStrings(value) {
    if (!Array.isArray(value)) return [];
    var seen = Object.create(null);
    return value.reduce(function (result, item) {
      if (typeof item !== "string") return result;
      var clean = item.trim();
      if (!clean || seen[clean]) return result;
      seen[clean] = true;
      result.push(clean);
      return result;
    }, []);
  }

  function cleanId(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function toScore(value) {
    var score = Number(value);
    if (!Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
  }

  function toAttempts(value) {
    var attempts = Number(value);
    if (!Number.isFinite(attempts) || attempts < 0) return 0;
    return Math.floor(attempts);
  }

  function normalizeQuizRecord(value) {
    var source = isRecord(value) ? value : {};
    return {
      moduleId: cleanId(source.moduleId || source.module_id) || null,
      highestScore: toScore(
        source.highestScore !== undefined
          ? source.highestScore
          : source.highest_score
      ),
      latestScore: toScore(
        source.latestScore !== undefined ? source.latestScore : source.latest_score
      ),
      attempts: toAttempts(source.attempts),
      passed: source.passed === true,
      passScore: toScore(
        source.passScore !== undefined ? source.passScore : source.pass_score
      ),
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
    };
  }

  function normalizeState(value) {
    var source = isRecord(value) ? value : {};
    var quizzes = {};
    if (isRecord(source.quizzes)) {
      Object.keys(source.quizzes).forEach(function (quizId) {
        var cleanQuizId = cleanId(quizId);
        if (cleanQuizId) quizzes[cleanQuizId] = normalizeQuizRecord(source.quizzes[quizId]);
      });
    }

    return {
      schemaVersion: 1,
      visitedModules: uniqueStrings(source.visitedModules || source.visited_modules),
      completedModules: uniqueStrings(
        source.completedModules || source.completed_modules
      ),
      lastModule: cleanId(source.lastModule || source.last_module) || null,
      quizzes: quizzes,
      projectCheckpoints: isRecord(
        source.projectCheckpoints || source.project_checkpoints
      )
        ? Object.assign(
            {},
            source.projectCheckpoints || source.project_checkpoints
          )
        : {},
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
    };
  }

  function cloneState(state) {
    return normalizeState(JSON.parse(JSON.stringify(state)));
  }

  function readStoredState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneState(memoryState);
      memoryState = normalizeState(JSON.parse(raw));
    } catch (_) {
      // Private browsing and hardened browser policies may block storage.
      // The in-memory copy still keeps the course usable for this page load.
    }
    return cloneState(memoryState);
  }

  function writeStoredState(state) {
    var normalized = normalizeState(state);
    normalized.updatedAt = new Date().toISOString();
    memoryState = normalized;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (_) {
      // Keep the normalized in-memory state when persistent storage is blocked.
    }
    return cloneState(normalized);
  }

  function makeEvent(name, detail) {
    if (typeof window.CustomEvent === "function") {
      return new CustomEvent(name, { detail: detail });
    }
    var event = document.createEvent("CustomEvent");
    event.initCustomEvent(name, false, false, detail);
    return event;
  }

  function emitProgress(reason, state, detail) {
    window.dispatchEvent(
      makeEvent(
        EVENT_PROGRESS,
        Object.assign(
          {
            reason: reason,
            state: cloneState(state),
          },
          detail || {}
        )
      )
    );
  }

  function mutateState(reason, mutator, detail) {
    var next = readStoredState();
    mutator(next);
    next = writeStoredState(next);
    emitProgress(reason, next, detail);
    refreshCompletionButtons(next);
    return next;
  }

  function getState() {
    return readStoredState();
  }

  function recordVisit(moduleId) {
    var id = cleanId(moduleId);
    if (!id) return getState();

    var current = readStoredState();
    if (
      current.lastModule === id &&
      current.visitedModules.indexOf(id) !== -1
    ) {
      return current;
    }

    return mutateState("module-visited", function (state) {
      if (state.visitedModules.indexOf(id) === -1) {
        state.visitedModules.push(id);
      }
      state.lastModule = id;
    }, { moduleId: id });
  }

  function completeModule(moduleId) {
    var id = cleanId(moduleId);
    if (!id) return getState();

    var current = readStoredState();
    if (current.completedModules.indexOf(id) !== -1) {
      refreshCompletionButtons(current);
      return current;
    }

    return mutateState("module-completed", function (state) {
      if (state.visitedModules.indexOf(id) === -1) {
        state.visitedModules.push(id);
      }
      if (state.completedModules.indexOf(id) === -1) {
        state.completedModules.push(id);
      }
      state.lastModule = id;
    }, { moduleId: id });
  }

  function recordQuizResult(resultOrQuizId, moduleId, score, passed, passScore) {
    var result = isRecord(resultOrQuizId)
      ? resultOrQuizId
      : {
          quizId: resultOrQuizId,
          moduleId: moduleId,
          score: score,
          passed: passed,
          passScore: passScore,
        };

    var quizId = cleanId(result.quizId || result.quiz_id || result.id);
    var cleanModuleId = cleanId(result.moduleId || result.module_id);
    if (!quizId) return getState();

    var numericScore = toScore(result.score);
    var numericPassScore = toScore(
      result.passScore !== undefined ? result.passScore : result.pass_score
    );
    var didPass =
      result.passed === true ||
      (numericPassScore > 0 && numericScore >= numericPassScore);

    return mutateState("quiz-submitted", function (state) {
      var previous = normalizeQuizRecord(state.quizzes[quizId]);
      state.quizzes[quizId] = {
        moduleId: cleanModuleId || previous.moduleId,
        highestScore: Math.max(previous.highestScore, numericScore),
        latestScore: numericScore,
        attempts: previous.attempts + 1,
        passed: previous.passed || didPass,
        passScore: numericPassScore || previous.passScore,
        updatedAt: new Date().toISOString(),
      };

      if (cleanModuleId) {
        if (state.visitedModules.indexOf(cleanModuleId) === -1) {
          state.visitedModules.push(cleanModuleId);
        }
        state.lastModule = cleanModuleId;
      }
    }, {
      quizId: quizId,
      moduleId: cleanModuleId || null,
      score: numericScore,
      passed: didPass,
    });
  }

  function setProjectCheckpoint(checkpointId, value) {
    var id = cleanId(checkpointId);
    if (!id) return getState();
    return mutateState("checkpoint-updated", function (state) {
      state.projectCheckpoints[id] = value;
    }, { checkpointId: id });
  }

  function resetProgress() {
    memoryState = createDefaultState();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // The in-memory reset remains effective when persistent storage is blocked.
    }
    var state = cloneState(memoryState);
    emitProgress("progress-reset", state);
    refreshCompletionButtons(state);
    return state;
  }

  function deriveAssetBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var src = scripts[i].getAttribute("src");
      if (!src || src.indexOf("extras/course/") === -1) continue;
      try {
        var scriptUrl = new URL(src, document.baseURI);
        var marker = "/extras/course/";
        var markerIndex = scriptUrl.pathname.lastIndexOf(marker);
        if (markerIndex === -1) continue;
        scriptUrl.pathname = scriptUrl.pathname.slice(
          0,
          markerIndex + marker.length
        );
        scriptUrl.search = "";
        scriptUrl.hash = "";
        return scriptUrl;
      } catch (_) {
        // Try the next matching script.
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

  function assetUrl(path) {
    var cleanPath = typeof path === "string" ? path.replace(/^\/+/, "") : "";
    return new URL(cleanPath, assetBase).href;
  }

  function siteRootUrl() {
    return new URL("../../", assetBase);
  }

  function courseUrl(moduleOrPath) {
    var value = cleanId(moduleOrPath);
    if (!value) return new URL("course/", siteRootUrl()).href;
    if (/^(?:https?:)?\/\//i.test(value)) return value;
    if (value.charAt(0) === "#") return value;

    var siteRoot = siteRootUrl();
    if (value.charAt(0) === "/") {
      return new URL(value.replace(/^\/+/, ""), siteRoot).href;
    }
    if (/^(?:course|book|book-en|chapter\d+)\//.test(value)) {
      return new URL(value, siteRoot).href;
    }
    return new URL("course/" + value.replace(/^\.?\//, "").replace(/\/?$/, "/"), siteRoot).href;
  }

  function detectCurrentModule() {
    var declared = document.querySelector("[data-course-module]");
    if (declared) {
      var declaredId = cleanId(declared.getAttribute("data-course-module"));
      if (declaredId) return declaredId;
    }

    var completeButton = document.querySelector(
      ".course-complete[data-course-complete], button[data-course-complete]"
    );
    if (completeButton) {
      var buttonId = cleanId(
        completeButton.getAttribute("data-course-complete")
      );
      if (buttonId) return buttonId;
    }

    var quiz = document.querySelector("course-quiz[data-module]");
    if (quiz) {
      var quizModule = cleanId(quiz.getAttribute("data-module"));
      if (quizModule) return quizModule;
    }

    var match = window.location.pathname.match(
      /\/course\/((?:0[0-6])-[a-z0-9-]+)\/?(?:index\.html)?$/i
    );
    return match ? match[1] : null;
  }

  function buttonModuleId(button) {
    return (
      cleanId(button.getAttribute("data-course-complete")) ||
      detectCurrentModule()
    );
  }

  function refreshCompletionButtons(state) {
    var current = state || readStoredState();
    var completed = current.completedModules;
    var buttons = document.querySelectorAll(
      ".course-complete[data-course-complete], button[data-course-complete]"
    );

    for (var i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      var moduleId = buttonModuleId(button);
      var isComplete = moduleId && completed.indexOf(moduleId) !== -1;
      button.classList.add("course-button");
      if (
        button.localName === "button" &&
        !button.hasAttribute("type")
      ) {
        button.type = "button";
      }

      if (!button.hasAttribute("data-course-original-label")) {
        button.setAttribute(
          "data-course-original-label",
          button.textContent.trim()
        );
      }

      if (isComplete) {
        button.setAttribute("aria-pressed", "true");
        button.setAttribute("aria-disabled", "true");
        if ("disabled" in button) button.disabled = true;
        button.textContent =
          button.getAttribute("data-completed-label") || "이 모듈을 완료했습니다";
      } else {
        button.setAttribute("aria-pressed", "false");
        button.removeAttribute("aria-disabled");
        if ("disabled" in button) button.disabled = false;
        button.textContent =
          button.getAttribute("data-course-original-label") ||
          "모듈 완료";
      }
    }
  }

  function enhancePlaceholders() {
    var quizPlaceholders = document.querySelectorAll(
      "[data-course-quiz], .course-quiz[data-quiz]"
    );
    for (var i = 0; i < quizPlaceholders.length; i += 1) {
      var placeholder = quizPlaceholders[i];
      if (
        placeholder.localName === "course-quiz" ||
        placeholder.getAttribute("data-course-enhanced") === "true"
      ) {
        continue;
      }
      var quiz = document.createElement("course-quiz");
      var quizId =
        placeholder.getAttribute("data-course-quiz") ||
        placeholder.getAttribute("data-quiz");
      if (quizId) quiz.setAttribute("data-quiz", quizId);
      var moduleId = placeholder.getAttribute("data-module");
      if (moduleId) quiz.setAttribute("data-module", moduleId);
      placeholder.setAttribute("data-course-enhanced", "true");
      placeholder.appendChild(quiz);
    }

    var progressPlaceholders = document.querySelectorAll(
      "[data-course-progress]"
    );
    for (var j = 0; j < progressPlaceholders.length; j += 1) {
      var progressPlaceholder = progressPlaceholders[j];
      if (
        progressPlaceholder.localName === "course-progress" ||
        progressPlaceholder.getAttribute("data-course-enhanced") === "true"
      ) {
        continue;
      }
      var progress = document.createElement("course-progress");
      progress.setAttribute(
        "data-view",
        progressPlaceholder.getAttribute("data-view") ||
          progressPlaceholder.getAttribute("data-course-progress") ||
          "dashboard"
      );
      progressPlaceholder.setAttribute("data-course-enhanced", "true");
      progressPlaceholder.appendChild(progress);
    }
  }

  function handleDocumentClick(event) {
    if (!(event.target instanceof Element)) return;
    var button = event.target.closest(
      ".course-complete[data-course-complete], button[data-course-complete]"
    );
    if (!button || button.disabled) return;
    var moduleId = buttonModuleId(button);
    if (!moduleId) return;
    completeModule(moduleId);
  }

  function handleStorage(event) {
    if (event.key !== STORAGE_KEY) return;
    memoryState = event.newValue
      ? normalizeState(safeParse(event.newValue))
      : createDefaultState();
    var state = cloneState(memoryState);
    emitProgress("storage-synced", state);
    refreshCompletionButtons(state);
  }

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return {};
    }
  }

  function init() {
    enhancePlaceholders();
    var moduleId = detectCurrentModule();
    var state = moduleId ? recordVisit(moduleId) : readStoredState();
    refreshCompletionButtons(state);
  }

  var api = {
    runtimeVersion: RUNTIME_VERSION,
    storageKey: STORAGE_KEY,
    progressEvent: EVENT_PROGRESS,
    getState: getState,
    recordVisit: recordVisit,
    recordQuizResult: recordQuizResult,
    completeModule: completeModule,
    setProjectCheckpoint: setProjectCheckpoint,
    resetProgress: resetProgress,
    assetUrl: assetUrl,
    courseUrl: courseUrl,
    detectCurrentModule: detectCurrentModule,
    init: init,
  };

  window.AIAgentCourse = api;

  document.addEventListener("click", handleDocumentClick);
  window.addEventListener("storage", handleStorage);
  document.addEventListener("DOMContentLoaded", init);
  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(init);
  }

  window.dispatchEvent(makeEvent(EVENT_READY, { api: api }));
  if (document.readyState !== "loading") init();
})();

/**
 * <course-quiz data-quiz="01-agent">
 *
 * Loads extras/course/data/quizzes/<data-quiz>.json and renders an accessible,
 * framework-free quiz. The primary data schema is:
 *
 * {
 *   "id": "...",
 *   "title": "...",
 *   "pass_score": 80,
 *   "questions": [{
 *     "id": "...",
 *     "prompt": "...",
 *     "options": [{ "id": "...", "label": "...", "feedback": "..." }],
 *     "answer": "...",
 *     "explanation": "..."
 *   }]
 * }
 */
(function () {
  "use strict";

  if (!window.customElements || customElements.get("course-quiz")) return;

  var instanceCount = 0;
  var READY_EVENT = "ai-agent-course:ready";
  var PROGRESS_EVENT = "ai-agent-course:progress";

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizedPassScore(value) {
    var score = Number(value);
    if (!Number.isFinite(score)) return 80;
    if (score >= 0 && score <= 1) score *= 100;
    return Math.max(0, Math.min(100, score));
  }

  function answerIds(question) {
    var answer =
      question.answer !== undefined
        ? question.answer
        : question.correctAnswer !== undefined
          ? question.correctAnswer
          : question.correct_answer;
    var values = Array.isArray(answer) ? answer : [answer];
    return values
      .map(function (value) {
        return cleanString(String(value === undefined ? "" : value));
      })
      .filter(Boolean);
  }

  function sameValues(left, right) {
    if (left.length !== right.length) return false;
    var sortedLeft = left.slice().sort();
    var sortedRight = right.slice().sort();
    for (var i = 0; i < sortedLeft.length; i += 1) {
      if (sortedLeft[i] !== sortedRight[i]) return false;
    }
    return true;
  }

  function fieldsetFor(form, questionId) {
    if (!form) return null;
    var fieldsets = form.querySelectorAll("fieldset[data-question-id]");
    for (var i = 0; i < fieldsets.length; i += 1) {
      if (fieldsets[i].getAttribute("data-question-id") === questionId) {
        return fieldsets[i];
      }
    }
    return null;
  }

  function normalizeOption(option, index) {
    if (typeof option === "string") {
      return {
        id: String(index + 1),
        label: option,
        feedback: "",
      };
    }
    var source = option && typeof option === "object" ? option : {};
    return {
      id: cleanString(String(source.id !== undefined ? source.id : index + 1)),
      label: cleanString(source.label || source.text || source.value),
      feedback: cleanString(source.feedback || source.explanation),
    };
  }

  function normalizeQuestion(question, index) {
    var source = question && typeof question === "object" ? question : {};
    var rawOptions = Array.isArray(source.options)
      ? source.options
      : Array.isArray(source.choices)
        ? source.choices
        : [];
    return {
      id: cleanString(String(source.id !== undefined ? source.id : index + 1)),
      prompt: cleanString(source.prompt || source.question),
      options: rawOptions.map(normalizeOption),
      answers: answerIds(source),
      explanation: cleanString(source.explanation),
    };
  }

  function normalizeQuiz(data, fallbackId) {
    var source = data && typeof data === "object" ? data : {};
    var rawQuestions = Array.isArray(source.questions) ? source.questions : [];
    return {
      id: cleanString(source.id) || fallbackId,
      title: cleanString(source.title) || "모듈 확인 퀴즈",
      moduleId: cleanString(source.module_id || source.moduleId || source.module),
      passScore: normalizedPassScore(
        source.pass_score !== undefined ? source.pass_score : source.passingScore
      ),
      questions: rawQuestions.map(normalizeQuestion),
    };
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
      ".quiz {",
      "  border: 1px solid var(--md-default-fg-color--lightest, #d8dee4);",
      "  border-radius: .65rem;",
      "  padding: clamp(1rem, 3vw, 1.5rem);",
      "  background: var(--md-default-bg-color, #fff);",
      "}",
      ".header { margin-bottom: 1rem; }",
      "h2 { margin: 0 0 .25rem; font-size: 1.15rem; line-height: 1.4; }",
      ".record {",
      "  margin: 0;",
      "  color: var(--md-default-fg-color--light, #57606a);",
      "  font-size: .85rem;",
      "}",
      "form { margin: 0; }",
      "fieldset {",
      "  min-width: 0;",
      "  margin: 0 0 1.1rem;",
      "  padding: 1rem;",
      "  border: 1px solid var(--md-default-fg-color--lightest, #d8dee4);",
      "  border-radius: .45rem;",
      "}",
      "fieldset[data-result='correct'] {",
      "  border-inline-start: .25rem solid #2e7d32;",
      "}",
      "fieldset[data-result='incorrect'] {",
      "  border-inline-start: .25rem solid #b45309;",
      "}",
      "fieldset[aria-invalid='true'] {",
      "  border-color: #b3261e;",
      "}",
      "legend {",
      "  max-width: 100%;",
      "  padding: 0 .3rem;",
      "  font-weight: 650;",
      "  line-height: 1.5;",
      "}",
      ".number {",
      "  margin-inline-end: .35rem;",
      "  color: var(--md-primary-fg-color, #5e35b1);",
      "}",
      ".options { display: grid; gap: .45rem; margin-top: .5rem; }",
      ".option {",
      "  display: grid;",
      "  grid-template-columns: auto minmax(0, 1fr);",
      "  gap: .55rem;",
      "  align-items: start;",
      "  padding: .55rem .65rem;",
      "  border-radius: .35rem;",
      "}",
      ".option:hover { background: var(--md-default-fg-color--lightest, #f3f4f6); }",
      ".option[data-result='answer']::after {",
      "  content: '정답';",
      "  grid-column: 2;",
      "  font-size: .75rem;",
      "  font-weight: 700;",
      "  color: #2e7d32;",
      "}",
      ".option[data-result='selected-wrong']::after {",
      "  content: '선택한 오답';",
      "  grid-column: 2;",
      "  font-size: .75rem;",
      "  font-weight: 700;",
      "  color: #b45309;",
      "}",
      "input { margin-top: .28rem; accent-color: var(--md-primary-fg-color, #5e35b1); }",
      "label { min-width: 0; cursor: pointer; }",
      ".feedback {",
      "  margin: .8rem 0 0;",
      "  padding: .7rem .8rem;",
      "  border-radius: .35rem;",
      "  background: var(--md-code-bg-color, #f6f8fa);",
      "  font-size: .88rem;",
      "}",
      ".feedback p { margin: .25rem 0; }",
      ".actions { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; }",
      "button {",
      "  appearance: none;",
      "  border: 0;",
      "  border-radius: .35rem;",
      "  padding: .65rem 1rem;",
      "  background: var(--md-primary-fg-color, #5e35b1);",
      "  color: var(--md-primary-bg-color, #fff);",
      "  font: inherit;",
      "  font-weight: 700;",
      "  cursor: pointer;",
      "}",
      "button:hover { filter: brightness(.93); }",
      "button:focus-visible, input:focus-visible, fieldset:focus-visible {",
      "  outline: .18rem solid var(--md-accent-fg-color, #7c4dff);",
      "  outline-offset: .15rem;",
      "}",
      ".summary {",
      "  flex: 1 1 14rem;",
      "  min-height: 1.5rem;",
      "  margin: 0;",
      "  font-weight: 650;",
      "}",
      ".status, .error {",
      "  margin: 0;",
      "  padding: .8rem;",
      "  border-radius: .35rem;",
      "  background: var(--md-code-bg-color, #f6f8fa);",
      "}",
      ".error { border-inline-start: .25rem solid #b3261e; }",
      "@media (max-width: 30rem) {",
      "  .quiz { padding: .85rem; }",
      "  fieldset { padding: .75rem; }",
      "  button { width: 100%; }",
      "}",
    ].join("\n");
  }

  class CourseQuiz extends HTMLElement {
    static get observedAttributes() {
      return ["data-quiz", "data-src"];
    }

    constructor() {
      super();
      instanceCount += 1;
      this._instanceId = "course-quiz-" + instanceCount;
      this._quiz = null;
      this._abortController = null;
      this._connected = false;
      this._loadToken = 0;
      this._onProgress = this._handleProgress.bind(this);
      this._onReady = this._handleReady.bind(this);
      this.attachShadow({ mode: "open" });
      var style = document.createElement("style");
      style.textContent = staticStyles();
      this.shadowRoot.appendChild(style);
      this._mount = element("section", "quiz");
      this._mount.setAttribute("aria-busy", "true");
      this.shadowRoot.appendChild(this._mount);
    }

    connectedCallback() {
      if (!this._connected) {
        window.addEventListener(PROGRESS_EVENT, this._onProgress);
        window.addEventListener(READY_EVENT, this._onReady);
        this._connected = true;
      }
      this._load();
    }

    disconnectedCallback() {
      if (this._connected) {
        window.removeEventListener(PROGRESS_EVENT, this._onProgress);
        window.removeEventListener(READY_EVENT, this._onReady);
        this._connected = false;
      }
      if (this._abortController) this._abortController.abort();
    }

    attributeChangedCallback(name, oldValue, newValue) {
      // When an already-connected Markdown element is upgraded after
      // customElements.define(), the browser invokes attributeChangedCallback
      // before connectedCallback. Loading here as well would start two
      // identical requests and abort the first one. Once connectedCallback has
      // registered the instance, later runtime attribute changes still reload.
      if (oldValue !== newValue && this._connected) this._load();
    }

    _api() {
      return window.AIAgentCourse || null;
    }

    _handleReady() {
      this._updateRecord();
    }

    _handleProgress() {
      this._updateRecord();
    }

    _quizId() {
      return cleanString(this.getAttribute("data-quiz"));
    }

    _moduleId() {
      var direct = cleanString(
        this.getAttribute("data-module") || this.getAttribute("module-id")
      );
      if (direct) return direct;
      if (this._quiz && this._quiz.moduleId) return this._quiz.moduleId;

      var owner = this.closest("[data-course-module]");
      if (owner) {
        var declared = cleanString(owner.getAttribute("data-course-module"));
        if (declared) return declared;
      }

      var api = this._api();
      return api && typeof api.detectCurrentModule === "function"
        ? api.detectCurrentModule()
        : null;
    }

    _quizUrl(quizId) {
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

      var filename = quizId.replace(/\.json$/i, "") + ".json";
      var relativePath = "data/quizzes/" + encodeURIComponent(filename);
      if (api && typeof api.assetUrl === "function") {
        return api.assetUrl(relativePath);
      }
      return new URL(relativePath, deriveCourseAssetBase()).href;
    }

    async _load() {
      var quizId = this._quizId();
      this._loadToken += 1;
      var token = this._loadToken;
      if (this._abortController) this._abortController.abort();
      this._abortController =
        typeof AbortController === "function" ? new AbortController() : null;

      if (!quizId) {
        this._renderError("불러올 퀴즈가 지정되지 않았습니다.");
        return;
      }

      this._quiz = null;
      this._renderStatus("퀴즈를 불러오는 중입니다…");

      try {
        var response = await fetch(this._quizUrl(quizId), {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: this._abortController ? this._abortController.signal : undefined,
        });
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        var raw = await response.json();
        if (token !== this._loadToken || !this.isConnected) return;
        var quiz = normalizeQuiz(raw, quizId);
        if (!quiz.questions.length) {
          throw new Error("empty quiz");
        }
        for (var i = 0; i < quiz.questions.length; i += 1) {
          var question = quiz.questions[i];
          var optionIds = question.options.map(function (option) {
            return option.id;
          });
          if (
            !question.id ||
            !question.prompt ||
            question.options.length < 2 ||
            optionIds.some(function (id) {
              return !id;
            }) ||
            !question.answers.length ||
            question.answers.some(function (answer) {
              return optionIds.indexOf(answer) === -1;
            })
          ) {
            throw new Error("invalid question");
          }
        }
        this._quiz = quiz;
        this._renderQuiz();
      } catch (error) {
        if (error && error.name === "AbortError") return;
        if (token !== this._loadToken || !this.isConnected) return;
        this._renderError(
          "퀴즈를 불러오지 못했습니다. 잠시 후 새로고침해 주세요."
        );
      }
    }

    _clearMount() {
      while (this._mount.firstChild) this._mount.removeChild(this._mount.firstChild);
    }

    _renderStatus(message) {
      this._clearMount();
      this._mount.setAttribute("aria-busy", "true");
      var status = element("p", "status", message);
      status.setAttribute("role", "status");
      this._mount.appendChild(status);
    }

    _renderError(message) {
      this._clearMount();
      this._mount.setAttribute("aria-busy", "false");
      var error = element("p", "error", message);
      error.setAttribute("role", "alert");
      this._mount.appendChild(error);
    }

    _renderQuiz() {
      this._clearMount();
      this._mount.setAttribute("aria-busy", "false");
      this._mount.setAttribute("aria-labelledby", this._instanceId + "-title");

      var header = element("header", "header");
      var title = element("h2", "", this._quiz.title);
      title.id = this._instanceId + "-title";
      this._record = element("p", "record");
      header.appendChild(title);
      header.appendChild(this._record);
      this._mount.appendChild(header);

      var form = document.createElement("form");
      form.noValidate = true;

      for (var i = 0; i < this._quiz.questions.length; i += 1) {
        form.appendChild(this._renderQuestion(this._quiz.questions[i], i));
      }

      var actions = element("div", "actions");
      var submit = element("button", "", "답안 제출");
      submit.type = "submit";
      var summary = element("p", "summary");
      summary.id = this._instanceId + "-summary";
      summary.setAttribute("role", "status");
      summary.setAttribute("aria-live", "polite");
      summary.setAttribute("aria-atomic", "true");
      summary.tabIndex = -1;
      actions.appendChild(submit);
      actions.appendChild(summary);
      form.appendChild(actions);
      form.addEventListener("submit", this._submit.bind(this));
      this._form = form;
      this._summary = summary;
      this._mount.appendChild(form);
      this._updateRecord();
    }

    _renderQuestion(question, index) {
      var fieldset = document.createElement("fieldset");
      fieldset.setAttribute("data-question-id", question.id);
      fieldset.tabIndex = -1;

      var legend = document.createElement("legend");
      var number = element("span", "number", String(index + 1) + ".");
      legend.appendChild(number);
      legend.appendChild(document.createTextNode(question.prompt));
      fieldset.appendChild(legend);

      var options = element("div", "options");
      var multiple = question.answers.length > 1;
      for (var i = 0; i < question.options.length; i += 1) {
        var option = question.options[i];
        var row = element("div", "option");
        row.setAttribute("data-option-id", option.id);
        var input = document.createElement("input");
        var inputId =
          this._instanceId + "-q" + index + "-o" + i;
        input.id = inputId;
        input.type = multiple ? "checkbox" : "radio";
        input.name = this._instanceId + "-question-" + index;
        input.value = option.id;
        input.setAttribute("data-question-id", question.id);
        var label = element("label", "", option.label);
        label.htmlFor = inputId;
        row.appendChild(input);
        row.appendChild(label);
        options.appendChild(row);
      }

      fieldset.appendChild(options);
      return fieldset;
    }

    _selectionsFor(question) {
      if (!this._form) return [];
      var fieldset = fieldsetFor(this._form, question.id);
      if (!fieldset) return [];
      return Array.prototype.map.call(
        fieldset.querySelectorAll("input:checked"),
        function (input) {
          return input.value;
        }
      );
    }

    _submit(event) {
      event.preventDefault();
      if (!this._quiz || !this._form) return;

      var firstUnanswered = null;
      for (var i = 0; i < this._quiz.questions.length; i += 1) {
        var question = this._quiz.questions[i];
        var fieldset = fieldsetFor(this._form, question.id);
        var unanswered = this._selectionsFor(question).length === 0;
        if (fieldset) {
          fieldset.setAttribute("aria-invalid", String(unanswered));
          if (unanswered && !firstUnanswered) firstUnanswered = fieldset;
        }
      }

      if (firstUnanswered) {
        this._summary.textContent = "모든 문항에 답한 뒤 제출해 주세요.";
        firstUnanswered.focus();
        return;
      }

      var results = [];
      var correctCount = 0;
      for (var j = 0; j < this._quiz.questions.length; j += 1) {
        var currentQuestion = this._quiz.questions[j];
        var selected = this._selectionsFor(currentQuestion);
        var correct = sameValues(selected, currentQuestion.answers);
        if (correct) correctCount += 1;
        results.push({
          question: currentQuestion,
          selected: selected,
          correct: correct,
        });
      }

      var score = Math.round(
        (correctCount / this._quiz.questions.length) * 100
      );
      var passed = score >= this._quiz.passScore;
      this._renderResults(results, score, passed);

      var api = this._api();
      if (api && typeof api.recordQuizResult === "function") {
        api.recordQuizResult({
          quizId: this._quiz.id,
          moduleId: this._moduleId(),
          score: score,
          passed: passed,
          passScore: this._quiz.passScore,
        });
      }

      this.toggleAttribute("data-passed", passed);
      this.dispatchEvent(
        new CustomEvent("ai-agent-course:quiz-result", {
          bubbles: true,
          composed: true,
          detail: {
            quizId: this._quiz.id,
            moduleId: this._moduleId(),
            score: score,
            passed: passed,
          },
        })
      );
    }

    _renderResults(results, score, passed) {
      for (var i = 0; i < results.length; i += 1) {
        var result = results[i];
        var fieldset = fieldsetFor(this._form, result.question.id);
        if (!fieldset) continue;
        fieldset.removeAttribute("aria-invalid");
        fieldset.setAttribute(
          "data-result",
          result.correct ? "correct" : "incorrect"
        );

        var oldFeedback = fieldset.querySelector(".feedback");
        if (oldFeedback) oldFeedback.remove();
        var rows = fieldset.querySelectorAll(".option");
        for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          var row = rows[rowIndex];
          var optionId = row.getAttribute("data-option-id");
          row.removeAttribute("data-result");
          if (result.question.answers.indexOf(optionId) !== -1) {
            row.setAttribute("data-result", "answer");
          } else if (result.selected.indexOf(optionId) !== -1) {
            row.setAttribute("data-result", "selected-wrong");
          }
        }

        var feedback = element("div", "feedback");
        feedback.id = this._instanceId + "-feedback-" + i;
        var verdict = element(
          "p",
          "",
          result.correct ? "정답입니다." : "다시 확인해 보세요."
        );
        feedback.appendChild(verdict);

        if (!result.correct) {
          var correctLabels = result.question.options
            .filter(function (option) {
              return result.question.answers.indexOf(option.id) !== -1;
            })
            .map(function (option) {
              return option.label;
            });
          if (correctLabels.length) {
            feedback.appendChild(
              element("p", "", "정답: " + correctLabels.join(", "))
            );
          }
        }

        var selectedFeedback = result.question.options
          .filter(function (option) {
            return (
              result.selected.indexOf(option.id) !== -1 && option.feedback
            );
          })
          .map(function (option) {
            return option.feedback;
          });
        if (selectedFeedback.length) {
          feedback.appendChild(element("p", "", selectedFeedback.join(" ")));
        }
        if (
          result.question.explanation &&
          selectedFeedback.indexOf(result.question.explanation) === -1
        ) {
          feedback.appendChild(
            element("p", "", result.question.explanation)
          );
        }
        fieldset.setAttribute("aria-describedby", feedback.id);
        fieldset.appendChild(feedback);
      }

      this._summary.textContent =
        "총 " +
        this._quiz.questions.length +
        "문항 중 " +
        results.filter(function (result) {
          return result.correct;
        }).length +
        "문항 정답, " +
        score +
        "점입니다. " +
        (passed ? "통과했습니다." : "해설을 확인하고 다시 시도해 보세요.");
      this._summary.focus();
    }

    _updateRecord() {
      if (!this._record || !this._quiz) return;
      var api = this._api();
      var state =
        api && typeof api.getState === "function" ? api.getState() : null;
      var record =
        state && state.quizzes ? state.quizzes[this._quiz.id] : null;
      if (!record || !record.attempts) {
        this._record.textContent =
          "통과 기준 " + this._quiz.passScore + "점 · 아직 제출한 기록이 없습니다.";
        return;
      }
      this._record.textContent =
        "통과 기준 " +
        this._quiz.passScore +
        "점 · 최고 " +
        record.highestScore +
        "점 · " +
        record.attempts +
        "회 시도";
    }
  }

  customElements.define("course-quiz", CourseQuiz);
})();

// Language switcher: populates a <select> dropdown in the header bar.
// On change, navigates to the equivalent page in the target language and
// rewrites the left sidebar (links + text) to match the new edition.
//
// window.LANG_CONFIG = { ko: {label, prefix, default?}, en: {...} }
// window.SITE_ROOT    = "https://karais89.github.io/ai-agent-book"

(function () {
  "use strict";

  // Don't run if LANG_CONFIG hasn't been injected by header.html yet.
  // header.html emits the <script>window.LANG_CONFIG = ...</script> before
  // this file loads, so this is just defensive.
  function bindWhenReady() {
    var cfg = window.LANG_CONFIG;
    if (!cfg) {
      // Retry shortly — header.html may inject it after this script runs.
      setTimeout(bindWhenReady, 50);
      return;
    }
    init(cfg);
  }

  function init(cfg) {
    // ── nav label translations ────────────────────────────────
    // Keyed by the Korean label in mkdocs.yml; values per target language.
    // When on a non-default language, sidebar text is replaced from this map.
    var NAV_I18N = {
      "홈": { en: "Home" },
      "들어가며": { en: "Introduction" },
      "1장 · AI 에이전트 기초": { en: "Chapter 1 · Getting Started with AI Agents" },
      "2장 · 컨텍스트 엔지니어링": { en: "Chapter 2 · Context Engineering" },
      "3장 · 사용자 메모리와 지식 베이스": { en: "Chapter 3 · User Memory & Knowledge Base" },
      "4장 · 도구": { en: "Chapter 4 · Tools" },
      "5장 · 코딩 에이전트와 코드 생성": { en: "Chapter 5 · Coding Agent & Code Generation" },
      "6장 · 에이전트 평가": { en: "Chapter 6 · Evaluating Agents" },
      "7장 · 모델 사후 학습": { en: "Chapter 7 · Model Post-Training" },
      "8장 · 에이전트의 지속적 진화": { en: "Chapter 8 · Continual Evolution of Agents" },
      "9장 · 멀티모달과 실시간 상호작용": { en: "Chapter 9 · Multimodal & Real-Time Interaction" },
      "10장 · 멀티 에이전트 협업": { en: "Chapter 10 · Multi-Agent Collaboration" },
      "맺음말": { en: "Afterword" },
      "생각해 볼 문제 참고 답안": { en: "Reference Answers" },
      "실습": { en: "Experiments" },
    };

    // Right-sidebar TOC title, fixed by theme.language at build
    // time — rewritten client-side on translated editions.
    var TOC_TITLE = {
      ko: "목차",
      en: "On this page",
    };

    var SITE_NAME = {
      ko: "AI 에이전트 깊이 이해하기",
      en: "AI Agents in Depth",
    };

    var SEARCH_STRINGS = {
      ko: {
        placeholder: "검색",
        searching: "검색 초기화",
        input: "검색어를 입력하세요",
        none: "검색어와 일치하는 문서가 없습니다",
        one: "1개의 일치하는 문서",
        other: "#개의 일치하는 문서",
        moreOne: "이 문서에서 1개의 검색 결과 더 보기",
        moreOther: "이 문서에서 #개의 검색 결과 더 보기",
        missing: "포함되지 않은 검색어",
      },
      en: {
        placeholder: "Search",
        searching: "Initializing search",
        input: "Type to start searching",
        none: "No matching documents",
        one: "1 matching document",
        other: "# matching documents",
        moreOne: "1 more on this page",
        moreOther: "# more on this page",
        missing: "Missing",
      },
    };

    // Material is rendered once with theme.language=ko. These labels are
    // therefore Korean even on the English edition and must be corrected at
    // runtime. Keep this map limited to theme chrome; book content is never
    // searched or replaced.
    var MATERIAL_UI_EN = {
      header: "Header",
      navigation: "Navigation",
      tabs: "Tabs",
      footer: "Footer",
      tocAria: "Table of contents",
      skip: "Skip to content",
      search: "Search",
      closeSearch: "Close search",
      share: "Share",
      clear: "Clear",
      showSidebar: "Show sidebar",
      hideSidebar: "Hide sidebar",
      repository: "Go to repository",
      edit: "Edit this page",
      view: "View source of this page",
      copy: "Copy to clipboard",
      copied: "Copied to clipboard",
      top: "Back to top",
      previous: "Previous",
      next: "Next",
      palette: {
        "다크 모드로 전환": "Switch to dark mode",
        "라이트 모드로 전환": "Switch to light mode",
      },
      sourceFacts: {
        "마지막 업데이트": "Last update",
        "작성일": "Created",
        "참여자들": "Contributors",
      },
    };

    // ── helpers ───────────────────────────────────────────────

    function detectLang(path) {
      // Match against prefix with trailing slash stripped, so both
      // "/book-en/" and "/book-en" map to "en".
      var p = path.replace(/\/$/, "");
      var codes = Object.keys(cfg).sort(function (a, b) {
        return cfg[b].prefix.length - cfg[a].prefix.length;
      });
      for (var i = 0; i < codes.length; i++) {
        var prefix = cfg[codes[i]].prefix.replace(/\/$/, "");
        if (p.indexOf(prefix) !== -1) return codes[i];
      }
      var readmeMatch = p.match(/\/README\.([a-zA-Z-]+)$/);
      if (readmeMatch) {
        for (var r = 0; r < codes.length; r++) {
          if (cfg[codes[r]].readmeSuffix === readmeMatch[1]) return codes[r];
        }
      }
      if (/^\/?chapter\d+$/.test(p)) {
        for (var d = 0; d < codes.length; d++) {
          if (cfg[codes[d]].default) return codes[d];
        }
      }
      // No language prefix matched. This happens on /chapterN/ experiment
      // index pages (experiments are language-agnostic, single copy).
      // Fall back to whatever the user last selected — stored in
      // sessionStorage so it survives SPA navigation and reloads.
      var remembered = null;
      try { remembered = sessionStorage.getItem("lang-switcher-active"); } catch (_) {}
      if (remembered && cfg[remembered]) return remembered;
      for (var c in cfg) {
        if (cfg.hasOwnProperty(c) && cfg[c].default) return c;
      }
      return "ko";
    }

    function rememberLang(code) {
      try { sessionStorage.setItem("lang-switcher-active", code); } catch (_) {}
    }

    // ── URL rewriting ────────────────────────────────────────
    // One function handles every URL case so there are no scattered patches.
    // Given the current path + target language, returns the new path under
    // the same site base, or null if no translation applies.
    //
    // URL shapes we have to handle:
    //   /                          → site home (per-language intro)
    //   /book[-lang]/chapterN[.suffix]/  → chapter prose
    //   /chapterN/                 → experiment index, Korean (README.md)
    //   /chapterN/README.<readmeSuffix>/ → experiment index, translated
    //   /chapterN/<exp>/           → individual experiment, shared source
    //                                 (jump to target lang's chapter prose)
    function translatePath(cleanPath, fromCode, toCode) {
      if (toCode === fromCode) return null;
      var src = cfg[fromCode];
      var dst = cfg[toCode];

      // Site home → target language's introduction.
      if (cleanPath === "/" || cleanPath === "/index.html") {
        return "/" + dst.prefix + "introduction" + (dst.suffix || "") + "/";
      }

      var pp = cleanPath.replace(/^\//, "").replace(/\/$/, "");

      // Chapter prose: <srcPrefix>chapterN[<srcSuffix>]
      // E.g. /book/chapter1/ or /book-en/chapter1/
      var proseRe = new RegExp("^" + escapeRe(src.prefix) + "chapter(\\d+)" + escapeRe(src.suffix || "") + "$");
      var proseMatch = pp.match(proseRe);
      if (proseMatch) {
        return "/" + dst.prefix + "chapter" + proseMatch[1] + (dst.suffix || "") + "/";
      }

      // Handling book pages that use a shared ASCII slug:
      // introduction, afterword, reference-answers, appendix, ...
      var bookPageRe = new RegExp(
        "^" +
          escapeRe(src.prefix) +
          "([a-z0-9-]+)" +
          escapeRe(src.suffix || "") +
          "$"
      );

      var bookPageMatch = pp.match(bookPageRe);

      if (bookPageMatch) {
        return (
          "/" +
          dst.prefix +
          bookPageMatch[1] +
          (dst.suffix || "") +
          "/"
        );
      }

      // Experiment index: /chapterN/ (Korean default) or
      // /chapterN/README.<readmeSuffix>/ (translated variants).
      if (/^chapter\d+$/.test(pp)) {
        // Korean experiment index. Switch to:
        //   ko → /chapterN/                (unchanged)
        //   other → /chapterN/README.<readmeSuffix>/
        return toCode === "ko"
          ? "/" + pp + "/"
          : "/" + pp + "/README." + dst.readmeSuffix + "/";
      }
      var readmeMatch = pp.match(/^chapter(\d+)\/README\.([a-zA-Z-]+)$/);
      if (readmeMatch) {
        return toCode === "ko"
          ? "/chapter" + readmeMatch[1] + "/"
          : "/chapter" + readmeMatch[1] + "/README." + dst.readmeSuffix + "/";
      }

      // Individual experiment page: /chapterN/<something>/ — one shared copy.
      // No translated copy exists, so jump to the target language's
      // chapter prose (the most useful nearby translated page).
      var expSubMatch = pp.match(/^(chapter\d+)\/[^?]+$/);
      if (expSubMatch && pp.indexOf("README.") === -1) {
        return "/" + dst.prefix + expSubMatch[1] + (dst.suffix || "") + "/";
      }

      return null;
    }

    function escapeRe(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function siteBasePath() {
      try {
        var configured = new URL(window.SITE_ROOT).pathname;
        if (configured.charAt(configured.length - 1) !== "/") configured += "/";
        if (
          configured === "/" ||
          location.pathname.indexOf(configured) === 0
        ) {
          return configured;
        }
      } catch (_) {}

      // Local previews and custom domains can serve the same build at a
      // different base path from config.site_url. Infer that path from the
      // first known content segment instead of navigating away from the
      // current origin.
      var p = location.pathname;
      var candidates = [
        p.indexOf("book-en/"),
        p.indexOf("book/"),
        p.search(/chapter\d+\//),
      ].filter(function (value) { return value >= 0; });
      var idx = candidates.length ? Math.min.apply(Math, candidates) : -1;
      if (idx === -1) return "/";
      return p.slice(0, idx);
    }

    // ── Material theme UI rewriting ───────────────────────────

    function setAttributes(selector, attributes) {
      var elements = document.querySelectorAll(selector);
      for (var i = 0; i < elements.length; i++) {
        for (var name in attributes) {
          if (
            attributes.hasOwnProperty(name) &&
            elements[i].getAttribute(name) !== attributes[name]
          ) {
            elements[i].setAttribute(name, attributes[name]);
          }
        }
      }
    }

    function setText(selector, value) {
      var elements = document.querySelectorAll(selector);
      for (var i = 0; i < elements.length; i++) {
        if (elements[i].textContent.trim() !== value) {
          elements[i].textContent = value;
        }
      }
    }

    // Replace only a direct text node so an adjacent Material icon remains
    // untouched (TOC labels and the back-to-top button both contain SVGs).
    function setDirectText(element, value) {
      if (!element) return;
      var nodes = element.childNodes;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
          if (nodes[i].textContent.trim() !== value) {
            nodes[i].textContent = value;
          }
          return;
        }
      }
    }

    function rewriteFooterLink(selector, direction) {
      var link = document.querySelector(selector);
      if (!link) return;

      var directionNode = link.querySelector(".md-footer__direction");
      if (directionNode && directionNode.textContent.trim() !== direction) {
        directionNode.textContent = direction;
      }

      var titleNode = link.querySelector(".md-footer__title .md-ellipsis");
      var title = titleNode ? titleNode.textContent.trim() : "";
      if (titleNode && NAV_I18N[title] && NAV_I18N[title].en) {
        title = NAV_I18N[title].en;
        titleNode.textContent = title;
      }
      link.setAttribute("aria-label", direction + (title ? ": " + title : ""));
    }

    function rewriteCopyButtons() {
      // The class changed across Material 9.x releases, but the clipboard
      // target attribute is stable. data-md-type covers current releases.
      var buttons = document.querySelectorAll(
        "[data-clipboard-target], .md-code__button[data-md-type='copy']"
      );
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute("title", MATERIAL_UI_EN.copy);
        buttons[i].setAttribute("aria-label", MATERIAL_UI_EN.copy);
      }
    }

    function translateSearchMessage(value) {
      var ko = SEARCH_STRINGS.ko;
      var en = SEARCH_STRINGS.en;
      if (value === ko.searching || value === "검색 엔진 초기화 중") {
        return en.searching;
      }
      if (value === ko.input || value === "검색어 입력") return en.input;
      if (value === ko.none) return en.none;
      if (value === ko.one) return en.one;
      if (value === ko.moreOne) return en.moreOne;

      var count = value.match(/^(.+?)개의 일치하는 문서$/);
      if (count) return en.other.replace("#", count[1]);
      count = value.match(/^이 문서에서 (.+?)개의 검색 결과 더 보기$/);
      if (count) return en.moreOther.replace("#", count[1]);
      return value;
    }

    function rewriteSearchRuntime() {
      var ko = SEARCH_STRINGS.ko;
      var en = SEARCH_STRINGS.en;
      var meta = document.querySelector(".md-search-result__meta");
      if (meta) {
        var current = meta.textContent.trim();
        var translated = translateSearchMessage(current);
        if (translated !== current) meta.textContent = translated;
      }

      var more = document.querySelectorAll(
        ".md-search-result__more summary div"
      );
      for (var i = 0; i < more.length; i++) {
        var currentMore = more[i].textContent.trim();
        var translatedMore = translateSearchMessage(currentMore);
        if (translatedMore !== currentMore) {
          more[i].textContent = translatedMore;
        }
      }

      // Keep the <del> elements containing missing query terms intact.
      var terms = document.querySelectorAll(".md-search-result__terms");
      for (var t = 0; t < terms.length; t++) {
        var nodes = terms[t].childNodes;
        for (var n = 0; n < nodes.length; n++) {
          if (
            nodes[n].nodeType === 3 &&
            nodes[n].textContent.indexOf(ko.missing) !== -1
          ) {
            nodes[n].textContent = nodes[n].textContent.replace(
              ko.missing,
              en.missing
            );
          }
        }
      }
    }

    function rewriteClipboardDialog() {
      var dialog = document.querySelector(".md-dialog__inner");
      if (!dialog) return;
      var message = dialog.textContent.trim();
      if (
        message === "클립보드에 복사됨" ||
        message === "클립보드로 복사됨"
      ) {
        dialog.textContent = MATERIAL_UI_EN.copied;
      }
    }

    function rewriteDynamicMaterialUi() {
      rewriteSearchRuntime();
      rewriteCopyButtons();
      rewriteClipboardDialog();
    }

    function rewriteMaterialUi(targetCode) {
      if (targetCode !== "en") {
        setAttributes("a.md-content__button:not([rel='edit'])", {
          title: "페이지 소스 보기",
          "aria-label": "페이지 소스 보기",
        });
        setAttributes(".md-header__button.md-logo img", {
          alt: "로고",
        });

        var copyright = document.querySelector(".md-copyright");
        if (copyright) {
          var copyrightNodes = copyright.childNodes;
          for (var c = 0; c < copyrightNodes.length; c++) {
            if (
              copyrightNodes[c].nodeType === 3 &&
              copyrightNodes[c].textContent.indexOf("Made with") !== -1
            ) {
              copyrightNodes[c].textContent =
                copyrightNodes[c].textContent.replace(
                  "Made with",
                  "제작 도구:"
                );
              break;
            }
          }
        }
        return;
      }

      if (document.title.indexOf(SITE_NAME.ko) !== -1) {
        document.title = document.title.replace(SITE_NAME.ko, SITE_NAME.en);
      }
      setText(
        ".md-header__topic:first-child .md-ellipsis",
        SITE_NAME.en
      );
      setAttributes(
        ".md-header__button.md-logo, .md-nav__button.md-logo",
        {
          title: SITE_NAME.en,
          "aria-label": SITE_NAME.en,
        }
      );
      setDirectText(
        document.querySelector(".md-nav--primary > .md-nav__title"),
        SITE_NAME.en
      );

      setText(".md-skip", MATERIAL_UI_EN.skip);
      setAttributes(".md-header__inner", {
        "aria-label": MATERIAL_UI_EN.header,
      });
      setAttributes(".md-header__button[for='__drawer']", {
        "aria-label": MATERIAL_UI_EN.navigation,
        title: MATERIAL_UI_EN.navigation,
      });
      setAttributes(".md-header__button[for='__search']", {
        "aria-label": MATERIAL_UI_EN.search,
        title: MATERIAL_UI_EN.search,
      });
      setAttributes(".md-search__icon[for='__search']", {
        "aria-label": MATERIAL_UI_EN.closeSearch,
        title: MATERIAL_UI_EN.closeSearch,
      });
      setAttributes(".md-nav--primary", {
        "aria-label": MATERIAL_UI_EN.navigation,
      });
      setAttributes(".md-nav--secondary", {
        "aria-label": MATERIAL_UI_EN.tocAria,
      });
      setAttributes(".md-tabs", {
        "aria-label": MATERIAL_UI_EN.tabs,
      });
      setAttributes(".md-footer__inner", {
        "aria-label": MATERIAL_UI_EN.footer,
      });

      var strings = SEARCH_STRINGS.en;
      setAttributes(".md-search__input", {
        placeholder: strings.placeholder,
        "aria-label": strings.placeholder,
      });
      setAttributes(".md-search__options", {
        "aria-label": MATERIAL_UI_EN.search,
      });
      setAttributes("[data-md-component='search-share']", {
        title: MATERIAL_UI_EN.share,
        "aria-label": MATERIAL_UI_EN.share,
      });
      setAttributes(".md-search__options button[type='reset']", {
        title: MATERIAL_UI_EN.clear,
        "aria-label": MATERIAL_UI_EN.clear,
      });

      setAttributes(".md-source", {
        title: MATERIAL_UI_EN.repository,
        "aria-label": MATERIAL_UI_EN.repository,
      });
      setAttributes("a.md-content__button[rel='edit']", {
        title: MATERIAL_UI_EN.edit,
        "aria-label": MATERIAL_UI_EN.edit,
      });
      setAttributes("a.md-content__button:not([rel='edit'])", {
        title: MATERIAL_UI_EN.view,
        "aria-label": MATERIAL_UI_EN.view,
      });

      var sidebarToggle = document.querySelector("[data-sidebar-toggle]");
      if (sidebarToggle) {
        var collapsed = document.documentElement.classList.contains(
          "sidebar-nav-collapsed"
        );
        var sidebarLabel = collapsed
          ? MATERIAL_UI_EN.showSidebar
          : MATERIAL_UI_EN.hideSidebar;
        sidebarToggle.setAttribute("title", sidebarLabel);
        sidebarToggle.setAttribute("aria-label", sidebarLabel);
      }

      var paletteLabels = document.querySelectorAll(
        "[data-md-component='palette'] [aria-label], " +
        "[data-md-component='palette'] [title]"
      );
      for (var p = 0; p < paletteLabels.length; p++) {
        var aria = paletteLabels[p].getAttribute("aria-label");
        var title = paletteLabels[p].getAttribute("title");
        if (aria && MATERIAL_UI_EN.palette[aria]) {
          paletteLabels[p].setAttribute(
            "aria-label",
            MATERIAL_UI_EN.palette[aria]
          );
        }
        if (title && MATERIAL_UI_EN.palette[title]) {
          var paletteTitle = MATERIAL_UI_EN.palette[title];
          paletteLabels[p].setAttribute(
            "title",
            paletteTitle
          );
          paletteLabels[p].setAttribute("aria-label", paletteTitle);
        }
      }

      var sourceFacts = document.querySelectorAll(
        ".md-source-file__fact .md-icon[title]"
      );
      for (var s = 0; s < sourceFacts.length; s++) {
        var fact = sourceFacts[s].getAttribute("title");
        if (MATERIAL_UI_EN.sourceFacts[fact]) {
          sourceFacts[s].setAttribute(
            "title",
            MATERIAL_UI_EN.sourceFacts[fact]
          );
        }
      }

      var top = document.querySelector("[data-md-component='top']");
      setDirectText(top, MATERIAL_UI_EN.top);
      rewriteFooterLink(
        ".md-footer__link--prev",
        MATERIAL_UI_EN.previous
      );
      rewriteFooterLink(
        ".md-footer__link--next",
        MATERIAL_UI_EN.next
      );
      rewriteDynamicMaterialUi();
    }

    var materialUiObserver = null;

    function observeMaterialUi(targetCode) {
      if (materialUiObserver) materialUiObserver.disconnect();
      if (targetCode !== "en" || !window.MutationObserver) return;

      if (!materialUiObserver) {
        materialUiObserver = new MutationObserver(function () {
          var basePath = siteBasePath();
          var cleanPath =
            "/" + location.pathname.slice(basePath.length).replace(/^\//, "");
          if (detectLang(cleanPath) === "en") rewriteDynamicMaterialUi();
        });
      }

      var search = document.querySelector(".md-search");
      var dialog = document.querySelector("[data-md-component='dialog']");
      var content = document.querySelector(".md-content");
      if (search) {
        materialUiObserver.observe(search, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
      if (dialog) {
        materialUiObserver.observe(dialog, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
      // Code-copy controls may be mounted lazily as blocks enter the viewport.
      if (content) {
        materialUiObserver.observe(content, {
          childList: true,
          subtree: true,
        });
      }
    }

    // ── sidebar rewriting (links + text) ──────────────────────

    function rewriteSidebar(targetCode) {
      var target = cfg[targetCode];
      var defCode = null;
      for (var c in cfg) { if (cfg[c].default) { defCode = c; break; } }
      defCode = defCode || "ko";

      var base = siteBasePath();
      if (base.charAt(base.length - 1) !== "/") base += "/";

      var links = document.querySelectorAll(".md-nav__link");
      for (var i = 0; i < links.length; i++) {
        var el = links[i];
        var href = el.getAttribute("href");
        var navText = el.querySelector(".md-ellipsis");
        var currentText = navText ? navText.textContent.trim() : "";

        if (href && href.charAt(0) !== "#") {
          // Resolve href to a clean path relative to docs root, then
          // translate it via the unified translatePath() function. This
          // handles prose links, experiment-index links, and the Korean
          // default in one place — no scattered patches.
          try {
            var u = new URL(href, location.href);
            if (u.origin === location.origin) {
              var linkPath = u.pathname;
              if (linkPath.indexOf(base) === 0) {
                var linkRel = "/" + linkPath.slice(base.length).replace(/^\//, "");
                var linkLang = /^\/chapter\d+\/?$/.test(linkRel)
                  ? defCode
                  : detectLang(linkRel);
                var translated = translatePath(linkRel, linkLang, targetCode);
                if (translated) {
                  el.setAttribute("href", base + translated.replace(/^\//, ""));
                }
              }
            }
          } catch (_) {}
        }

        if (navText && NAV_I18N[currentText] && NAV_I18N[currentText][targetCode]) {
          navText.textContent = NAV_I18N[currentText][targetCode];
        }
      }

      // Translate the drawer's per-chapter sub-nav headers. When a chapter
      // subtree is opened on mobile, Material shows the chapter title again
      // as <label class="md-nav__title">2장 …</label>; those labels are
      // plain text (not .md-nav__link), so the loop above misses them. The
      // site-name title at the top is not in NAV_I18N and stays untouched.
      var subTitles = document.querySelectorAll(".md-sidebar--primary .md-nav__title");
      for (var st = 0; st < subTitles.length; st++) {
        var stNodes = subTitles[st].childNodes;
        for (var sn = 0; sn < stNodes.length; sn++) {
          var node = stNodes[sn];
          if (node.nodeType !== 3) continue;
          var key = node.textContent.trim();
          if (key && NAV_I18N[key] && NAV_I18N[key][targetCode]) {
            node.textContent = NAV_I18N[key][targetCode];
          }
        }
      }

      // Translate the right-sidebar TOC title. Only replace the text node —
      // the label also contains the (mobile-only) back-arrow icon span.
      if (TOC_TITLE[targetCode]) {
        var tocTitles = document.querySelectorAll(".md-nav--secondary > .md-nav__title");
        for (var t = 0; t < tocTitles.length; t++) {
          var nodes = tocTitles[t].childNodes;
          for (var n = 0; n < nodes.length; n++) {
            if (nodes[n].nodeType === 3 && nodes[n].textContent.trim()) {
              nodes[n].textContent = TOC_TITLE[targetCode];
            }
          }
        }
      }

      // Keep the search placeholder aligned with the active edition. Dynamic
      // status/result strings are handled by rewriteSearchRuntime().
      var strings = SEARCH_STRINGS[targetCode] || SEARCH_STRINGS.en;
      var searchInput = document.querySelector(".md-search__input");
      if (searchInput) {
        searchInput.setAttribute("placeholder", strings.placeholder);
      }
    }

    // ── language switch (the actual navigation) ──────────────

    function applyDocumentLocale(code) {
      document.documentElement.lang = code;
      document.documentElement.dir = "ltr";
    }

    function switchTo(target) {
      var rawPath = location.pathname;
      var basePath = siteBasePath();
      var cleanPath = "/" + rawPath.slice(basePath.length).replace(/^\//, "");
      var activeLang = detectLang(cleanPath);
      applyDocumentLocale(activeLang);
      if (!target || target === activeLang) return;
      var rel = translatePath(cleanPath, activeLang, target);
      if (!rel) return;
      var targetPath =
        basePath.replace(/\/?$/, "/") + rel.replace(/^\//, "");
      var finalUrl = new URL(targetPath, location.origin).href;
      // Force a full page reload (bypass Material's navigation.instant, which
      // intercepts location.href and may bounce the user back). We're moving
      // to a different language edition, which is a different "site" — full
      // reload is the right semantic anyway.
      window.location.replace(finalUrl);
    }

    // ── render the <select> options ──────────────────────────

    function render() {
      var rawPath = location.pathname;
      var basePath = siteBasePath();
      var cleanPath = "/" + rawPath.slice(basePath.length).replace(/^\//, "");
      var activeLang = detectLang(cleanPath);
      applyDocumentLocale(activeLang);
      rewriteMaterialUi(activeLang);
      observeMaterialUi(activeLang);

      var sel = document.getElementById("lang-selector");
      if (!sel) return;
      sel.setAttribute(
        "aria-label",
        activeLang === "en" ? "Switch language" : "언어 전환"
      );

      // Build options on first sight of an empty select.
      if (sel.children.length === 0) {
        var codes = Object.keys(cfg);
        for (var idx = 0; idx < codes.length; idx++) {
          var code = codes[idx];
          var opt = document.createElement("option");
          opt.value = code;
          opt.textContent = cfg[code].label;
          if (code === activeLang) opt.selected = true;
          sel.appendChild(opt);
        }
      } else {
        // Update which option is selected for the current page.
        sel.value = activeLang;
      }

      var defCode = null;
      for (var c in cfg) { if (cfg[c].default) { defCode = c; break; } }
      rememberLang(activeLang);
      if (activeLang !== (defCode || "ko")) {
        rewriteSidebar(activeLang);
      }
    }

    // ── bootstrap ────────────────────────────────────────────

    // Bind the change handler ONCE via event delegation. This way it keeps
    // working even if Material re-creates the <select> during SPA navigation.
    if (!window.__langSwitcherBound) {
      window.__langSwitcherBound = true;
      document.addEventListener("change", function (e) {
        if (!e.target || e.target.id !== "lang-selector") return;
        switchTo(e.target.value);
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", render);
    } else {
      render();
    }
    // Re-run on every Material SPA navigation. Material exposes document$
    // (a ReactiveSubscribable) that fires after each navigation.instant
    // page swap. Without this hook, the sidebar DOM gets re-rendered by
    // Material with the original Korean nav text and we never get to
    // translate it for non-default languages.
    if (window.document$) {
      window.document$.subscribe(render);
    } else {
      // Fallback for older Material or other themes.
      document.addEventListener("locationchange", render);
      var _pushState = history.pushState;
      history.pushState = function () {
        _pushState.apply(this, arguments);
        setTimeout(render, 60);
      };
    }
  }

  bindWhenReady();
})();

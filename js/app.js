// Small app shell: page routing, the DE/EN toggle and the intro splash.
// No framework and no build step — plain DOM updates driven by one state
// object, using the same `data-active="true"` attribute pattern the CSS
// already uses for the scenario chips.

(() => {
  const state = {
    view: "home", // "home" | "werdegang" | "projekte" | "kontakt" | "aktivitaet"
    lang: "de", // "de" | "en"
    scenario: "Melaten", // "Melaten" | "Aachen" | "Jackerath"
    theme: "dark", // "dark" | "light"
  };

  const introOverlay = document.querySelector(".intro-overlay");
  const views = document.querySelectorAll(".view");
  const navLinks = document.querySelectorAll("[data-view-link]");
  const langButtons = document.querySelectorAll("[data-lang-btn]");
  const themeToggle = document.querySelector("[data-theme-toggle]");
  const metaThemeColor = document.querySelector("#meta-theme-color");
  const scenarioChips = document.querySelectorAll("[data-set-scenario]");
  const scenarioCaptions = document.querySelectorAll("[data-scenario-caption]");
  const scenarioElements = document.querySelectorAll("scenario-map, prr-surface");
  const footer = document.querySelector(".site-footer");
  const dropdownToggle = document.querySelector("[data-dropdown-toggle]");
  const dropdownMenu = document.querySelector("[data-dropdown-menu]");

  // -- translation --
  // Static content is translated declaratively: any element carrying
  // data-en (plain text), data-en-html (nested markup), data-en-alt or
  // data-en-aria-label is swapped between its original German content
  // (captured once, on first run) and that English value. Custom
  // elements with their own JS-generated German strings (car-net,
  // scenario-map, github-contrib, prr-surface) expose a setLang(lang)
  // method instead, called below.
  const textNodes = document.querySelectorAll("[data-en]");
  const htmlNodes = document.querySelectorAll("[data-en-html]");
  const altNodes = document.querySelectorAll("[data-en-alt]");
  const ariaNodes = document.querySelectorAll("[data-en-aria-label]");
  const translatableElements = document.querySelectorAll(
    "car-net, scenario-map, github-contrib, prr-surface, particle-net"
  );

  textNodes.forEach((el) => {
    if (el.dataset.de === undefined) el.dataset.de = el.textContent;
  });
  htmlNodes.forEach((el) => {
    if (el.dataset.deHtml === undefined) el.dataset.deHtml = el.innerHTML;
  });
  altNodes.forEach((el) => {
    if (el.dataset.deAlt === undefined) el.dataset.deAlt = el.alt;
  });
  ariaNodes.forEach((el) => {
    if (el.dataset.deAriaLabel === undefined) {
      el.dataset.deAriaLabel = el.getAttribute("aria-label") || "";
    }
  });

  function setView(view) {
    state.view = view;

    views.forEach((section) => {
      section.setAttribute("data-active", String(section.dataset.view === view));
    });
    navLinks.forEach((link) => {
      link.setAttribute("data-active", String(link.dataset.viewLink === view));
    });
    if (footer) {
      footer.hidden = view === "home";
    }

    window.scrollTo(0, 0);
  }

  function setLang(lang) {
    state.lang = lang;
    document.documentElement.setAttribute("lang", lang);
    langButtons.forEach((btn) => {
      btn.setAttribute("data-active", String(btn.dataset.langBtn === lang));
    });

    const en = lang === "en";
    textNodes.forEach((el) => {
      el.textContent = en ? el.dataset.en : el.dataset.de;
    });
    htmlNodes.forEach((el) => {
      el.innerHTML = en ? el.dataset.enHtml : el.dataset.deHtml;
    });
    altNodes.forEach((el) => {
      el.alt = en ? el.dataset.enAlt : el.dataset.deAlt;
    });
    ariaNodes.forEach((el) => {
      el.setAttribute("aria-label", en ? el.dataset.enAriaLabel : el.dataset.deAriaLabel);
    });
    translatableElements.forEach((el) => {
      if (typeof el.setLang === "function") el.setLang(lang);
    });
  }

  // -- theme (dark/light) --
  // Stored in localStorage (bk-theme), so no cookie banner is needed.
  // Stored choice wins; otherwise the OS prefers-color-scheme is used.
  const THEME_KEY = "bk-theme";
  function getStoredTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      return t === "light" || t === "dark" ? t : null;
    } catch (e) {
      return null;
    }
  }
  function getPreferredTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  }
  function applyThemeToDom(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", theme === "light" ? "#f2f3f8" : "#161826");
    }
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(theme === "light"));
    }
  }
  function setTheme(theme, opts) {
    state.theme = theme;
    applyThemeToDom(theme);
    if (!opts || opts.persist !== false) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
    }
    translatableElements.forEach((el) => {
      if (typeof el.setTheme === "function") el.setTheme(theme);
    });
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }
  function initTheme() {
    const stored = getStoredTheme();
    setTheme(stored || getPreferredTheme(), { persist: false });
    // Follow OS changes only while the user has not chosen manually.
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: light)");
      const onChange = (e) => {
        if (!getStoredTheme()) setTheme(e.matches ? "light" : "dark", { persist: false });
      };
      if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
      else if (typeof mq.addListener === "function") mq.addListener(onChange);
    }
  }

  function setScenario(scenario) {
    state.scenario = scenario;
    scenarioChips.forEach((chip) => {
      chip.setAttribute("data-active", String(chip.dataset.setScenario === scenario));
    });
    scenarioCaptions.forEach((caption) => {
      caption.setAttribute("data-active", String(caption.dataset.scenarioCaption === scenario));
    });
    scenarioElements.forEach((el) => el.setAttribute("scenario", scenario));
  }

  // -- "Weiteres" nav dropdown --
  // The menu panel lives outside .nav-links (which scrolls/masks its
  // contents) and is positioned with a fixed offset computed from the
  // toggle button's own position, so it always lands right under it
  // regardless of nav scroll state or screen size.
  function closeDropdown() {
    if (!dropdownToggle || !dropdownMenu) return;
    dropdownMenu.hidden = true;
    dropdownToggle.setAttribute("aria-expanded", "false");
  }
  function openDropdown() {
    if (!dropdownToggle || !dropdownMenu) return;
    const r = dropdownToggle.getBoundingClientRect();
    dropdownMenu.style.top = r.bottom + 8 + "px";
    dropdownMenu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - dropdownMenu.offsetWidth - 8 || r.left)) + "px";
    dropdownMenu.hidden = false;
    dropdownToggle.setAttribute("aria-expanded", "true");
    // measure once visible, then clamp again in case the panel is wider
    // than the estimate above (offsetWidth is 0 while hidden)
    requestAnimationFrame(() => {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - dropdownMenu.offsetWidth - 8));
      dropdownMenu.style.left = left + "px";
    });
  }

  // -- kontakt: copy-email card --
  // Clicking the e-mail card copies the address and briefly swaps its
  // subtitle + icon to a "copied" state instead of navigating anywhere.
  function copyEmail(card) {
    const email = card.dataset.copyEmail;
    const sub = card.querySelector("[data-copy-default]");
    const idleIcon = card.querySelector("[data-copy-icon-idle]");
    const doneIcon = card.querySelector("[data-copy-icon-done]");
    if (!card._copyOriginal && sub) card._copyOriginal = sub.textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email).catch(() => {});
    }

    card.setAttribute("data-copied", "true");
    if (sub) sub.textContent = state.lang === "en" ? "Copied!" : "Kopiert!";
    if (idleIcon) idleIcon.hidden = true;
    if (doneIcon) doneIcon.hidden = false;

    clearTimeout(card._copyTimer);
    card._copyTimer = setTimeout(() => {
      card.removeAttribute("data-copied");
      if (sub) sub.textContent = card._copyOriginal || email;
      if (idleIcon) idleIcon.hidden = false;
      if (doneIcon) doneIcon.hidden = true;
    }, 1600);
  }

  // Delegate every click so we don't need a listener per element.
  document.addEventListener("click", (event) => {
    const navTarget = event.target.closest("[data-nav]");
    if (navTarget) {
      event.preventDefault();
      setView(navTarget.dataset.nav);
      closeDropdown();
      return;
    }

    const langTarget = event.target.closest("[data-lang-btn]");
    if (langTarget) {
      event.preventDefault();
      setLang(langTarget.dataset.langBtn);
      return;
    }

    const themeTarget = event.target.closest("[data-theme-toggle]");
    if (themeTarget) {
      event.preventDefault();
      setTheme(state.theme === "light" ? "dark" : "light");
      return;
    }

    const scenarioTarget = event.target.closest("[data-set-scenario]");
    if (scenarioTarget) {
      event.preventDefault();
      setScenario(scenarioTarget.dataset.setScenario);
      return;
    }

    const dropdownTarget = event.target.closest("[data-dropdown-toggle]");
    if (dropdownTarget) {
      event.preventDefault();
      if (dropdownMenu && dropdownMenu.hidden) openDropdown();
      else closeDropdown();
      return;
    }

    const copyTarget = event.target.closest("[data-copy-email]");
    if (copyTarget) {
      event.preventDefault();
      copyEmail(copyTarget);
      return;
    }

    if (dropdownMenu && !dropdownMenu.hidden && !event.target.closest("[data-dropdown-menu]")) {
      closeDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDropdown();
  });
  window.addEventListener("scroll", closeDropdown, { passive: true });
  window.addEventListener("resize", closeDropdown);

  // Splash screen: shown briefly on load, then faded out.
  if (introOverlay) {
    setTimeout(() => introOverlay.setAttribute("data-state", "exit"), 1800);
    setTimeout(() => introOverlay.setAttribute("data-state", "done"), 2400);
  }

  setView(state.view);
  initTheme();
  setLang(state.lang);
  setScenario(state.scenario);
})();

// Injects the shared header into every page that loads this script.
// Put in repo root as: header.js
(function () {
  function normalizePath(p) {
    return (p || "/").toLowerCase().replace(/index\.html$/, "");
  }

  function setActiveNav() {
    const path = normalizePath(location.pathname || "/");

    const markActive = (selector) => {
      document.querySelectorAll(selector).forEach((a) => {
        a.classList.remove("is-active");
        const href = normalizePath(a.getAttribute("href") || "");
        const isHome = href === "/" && (path === "/" || path === "");
        const isMatch = href !== "/" && href !== "" && path.startsWith(href);
        if (isHome || isMatch) a.classList.add("is-active");
      });
    };

    markActive(".twm-pill");
    markActive(".twm-mobile-link");
  }

  function closeMenu() {
    const wrap = document.querySelector(".twm-header-wrap");
    const menu = document.getElementById("twm-mobile-menu");
    const btn = document.querySelector(".twm-menu-btn");
    if (!wrap || !menu || !btn) return;

    wrap.classList.remove("is-menu-open");
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    const wrap = document.querySelector(".twm-header-wrap");
    const menu = document.getElementById("twm-mobile-menu");
    const btn = document.querySelector(".twm-menu-btn");
    if (!wrap || !menu || !btn) return;

    wrap.classList.add("is-menu-open");
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }

  function toggleMenu() {
    const menu = document.getElementById("twm-mobile-menu");
    if (!menu) return;
    if (menu.hidden) openMenu();
    else closeMenu();
  }

  function bindMenuEvents() {
    const btn = document.querySelector(".twm-menu-btn");
    const menu = document.getElementById("twm-mobile-menu");
    const wrap = document.querySelector(".twm-header-wrap");
    if (!btn || !menu || !wrap) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleMenu();
    });

    // Close menu when clicking a link
    menu.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (a) closeMenu();
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (menu.hidden) return;
      if (wrap.contains(e.target)) return;
      closeMenu();
    });

    // Close on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    // If screen becomes desktop, close menu
    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) closeMenu();
    });
  }

  async function injectHeader() {
    // If header already exists, do nothing.
    if (document.querySelector(".twm-header-wrap")) return;

    try {
      const res = await fetch("/header.html", { cache: "no-store" });
      if (!res.ok) throw new Error("header.html not found");
      const html = await res.text();

      // Prefer the placeholder div when present to avoid layout quirks
      const mount = document.getElementById("site-header");
      if (mount) mount.innerHTML = html;
      else document.body.insertAdjacentHTML("afterbegin", html);

      // Optional: add class to main container if found
      const main = document.querySelector("main");
      if (main) main.classList.add("twm-page");

      setActiveNav();
      bindMenuEvents();
    } catch (e) {
      console.warn("Header inject failed:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectHeader);
  } else {
    injectHeader();
  }
})();

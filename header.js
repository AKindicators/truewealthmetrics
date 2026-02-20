// Injects the shared header into every page that loads this script.
// Put in repo root as: header.js
//
// Requirements for each page:
// 1) Include <div id="site-header"></div> at top of <body>
// 2) Load /header.js (defer) and /styles.css (or header.js will inject styles.css if missing)

(function () {
  const STYLE_HREF = "/styles.css";

  function ensureStylesheet() {
    try {
      const has = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((l) => {
        const href = (l.getAttribute("href") || "").trim();
        return href === STYLE_HREF || href.endsWith("/styles.css") || href.includes("styles.css");
      });
      if (!has) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = STYLE_HREF;
        document.head.appendChild(link);
      }
    } catch (_) {}
  }

  function normalizePath(p) {
    const x = (p || "/").toLowerCase();
    // normalize: ensure trailing slash for folder-style pages
    if (x === "/" || x.endsWith("/")) return x;
    // if file-style, leave
    if (x.includes(".")) return x;
    return x + "/";
  }

  function setActiveNav() {
    const path = normalizePath(location.pathname || "/");

    // desktop pills
    document.querySelectorAll(".twm-pill").forEach((a) => {
      a.classList.remove("is-active");
      const href = normalizePath(a.getAttribute("href") || "/");
      const isHome = href === "/" && (path === "/" || path === "/index.html");
      const isMatch = href !== "/" && path.startsWith(href);
      if (isHome || isMatch) a.classList.add("is-active");
    });

    // mobile drawer links
    document.querySelectorAll(".twm-menu-link").forEach((a) => {
      a.classList.remove("is-active");
      const href = normalizePath(a.getAttribute("href") || "/");
      const isHome = href === "/" && (path === "/" || path === "/index.html");
      const isMatch = href !== "/" && path.startsWith(href);
      if (isHome || isMatch) a.classList.add("is-active");
    });
  }

  function openMenu() {
    document.body.classList.add("twm-menu-open");
    const btn = document.querySelector(".twm-menu-btn");
    if (btn) btn.setAttribute("aria-expanded", "true");

    const overlay = document.querySelector(".twm-menu-overlay");
    const drawer = document.getElementById("twm-mobile-menu");
    if (overlay) overlay.hidden = false;
    if (drawer) drawer.hidden = false;

    // focus management
    const first = drawer && drawer.querySelector("a,button");
    if (first) first.focus();
  }

  function closeMenu() {
    document.body.classList.remove("twm-menu-open");
    const btn = document.querySelector(".twm-menu-btn");
    if (btn) btn.setAttribute("aria-expanded", "false");

    const overlay = document.querySelector(".twm-menu-overlay");
    const drawer = document.getElementById("twm-mobile-menu");
    if (overlay) overlay.hidden = true;
    if (drawer) drawer.hidden = true;

    if (btn) btn.focus();
  }

  function wireMenu() {
    const btn = document.querySelector(".twm-menu-btn");
    const overlay = document.querySelector(".twm-menu-overlay");
    const drawer = document.getElementById("twm-mobile-menu");
    if (!btn || !overlay || !drawer) return;

    // Open
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      if (expanded) closeMenu();
      else openMenu();
    });

    // Close on overlay / close button
    document.querySelectorAll("[data-twm-close='1']").forEach((el) => {
      el.addEventListener("click", closeMenu);
    });

    // Close on link click
    drawer.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        closeMenu();
      });
    });

    // Close on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("twm-menu-open")) {
        closeMenu();
      }
    });

    // Safety: if viewport becomes desktop, close menu
    window.addEventListener("resize", () => {
      if (window.innerWidth > 860 && document.body.classList.contains("twm-menu-open")) {
        closeMenu();
      }
    });
  }

  async function injectHeader() {
    // If header already exists, do nothing.
    if (document.querySelector(".twm-header-wrap")) {
      ensureStylesheet();
      setActiveNav();
      wireMenu();
      return;
    }

    ensureStylesheet();

    try {
      const res = await fetch("/header.html", { cache: "no-store" });
      if (!res.ok) throw new Error("header.html not found");
      const html = await res.text();

      // Prefer the placeholder div when present to avoid layout quirks
      const mount = document.getElementById("site-header");
      if (mount) {
        mount.innerHTML = html;
      } else {
        // Fallback: Insert at very top of body
        document.body.insertAdjacentHTML("afterbegin", html);
      }

      // Optional: wrap page content a bit for spacing consistency
      const main = document.querySelector("main");
      if (main) main.classList.add("twm-page");

      setActiveNav();
      wireMenu();
    } catch (e) {
      // Fails silently (page still works)
      console.warn("Header inject failed:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectHeader);
  } else {
    injectHeader();
  }
})();

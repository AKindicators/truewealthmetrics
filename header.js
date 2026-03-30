// Injects the shared header into every page that loads this script.
// Put in repo root as: header.js

(function () {
  // Cache-bust stylesheet (forces browsers/CDN to fetch latest CSS)
  (function injectLatestStyles() {
    try {
      const id = "twm-style-bust";
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      // Update this version string when you change styles.css
      link.href = "/styles.css?v=20260330-elite8";
      document.head.appendChild(link);
    } catch (e) {}
  })();

  function setActiveNav() {
    const path = (location.pathname || "/").toLowerCase();

    document.querySelectorAll(".twm-pill").forEach((a) => {
      a.classList.remove("is-active");

      const href = (a.getAttribute("href") || "").toLowerCase();
      const isHome = href === "/" && (path === "/" || path === "/index.html");
      const isMatch = !isHome && href !== "/" && path.startsWith(href);

      if (isHome || isMatch) a.classList.add("is-active");
    });
  }

  function closeMobileMenu() {
    const wrap = document.querySelector(".twm-header-wrap");
    const toggle = document.querySelector(".twm-mobile-toggle");
    const panel = document.querySelector(".twm-mobile-panel");

    if (wrap) wrap.classList.remove("is-mobile-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation menu");
    }
    if (panel) panel.setAttribute("hidden", "");
    document.body.classList.remove("twm-mobile-nav-open");
  }

  function openMobileMenu() {
    const wrap = document.querySelector(".twm-header-wrap");
    const toggle = document.querySelector(".twm-mobile-toggle");
    const panel = document.querySelector(".twm-mobile-panel");

    if (wrap) wrap.classList.add("is-mobile-open");
    if (toggle) {
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close navigation menu");
    }
    if (panel) panel.removeAttribute("hidden");
    document.body.classList.add("twm-mobile-nav-open");
  }

  function toggleMobileMenu() {
    const wrap = document.querySelector(".twm-header-wrap");
    if (!wrap) return;

    if (wrap.classList.contains("is-mobile-open")) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  function buildMobileHeader() {
    const wrap = document.querySelector(".twm-header-wrap");
    const header = wrap ? wrap.querySelector(".twm-header") : null;
    const brand = wrap ? wrap.querySelector(".twm-brand") : null;
    const nav = wrap ? wrap.querySelector(".twm-nav") : null;

    if (!wrap || !header || !brand || !nav) return;
    if (wrap.querySelector(".twm-mobile-topbar")) return;

    const topbar = document.createElement("div");
    topbar.className = "twm-mobile-topbar";

    const brandClone = brand.cloneNode(true);
    brandClone.classList.add("twm-brand-mobile");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "twm-mobile-toggle";
    toggle.setAttribute("aria-label", "Open navigation menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `
      <span class="twm-mobile-toggle-box" aria-hidden="true">
        <span class="twm-mobile-toggle-line"></span>
        <span class="twm-mobile-toggle-line"></span>
        <span class="twm-mobile-toggle-line"></span>
      </span>
      <span class="twm-mobile-toggle-text">Menu</span>
    `;

    topbar.appendChild(brandClone);
    topbar.appendChild(toggle);

    const panel = document.createElement("div");
    panel.className = "twm-mobile-panel";
    panel.setAttribute("hidden", "");

    const navClone = nav.cloneNode(true);
    navClone.classList.add("twm-mobile-nav");

    panel.appendChild(navClone);

    header.prepend(topbar);
    header.appendChild(panel);

    toggle.addEventListener("click", toggleMobileMenu);

    panel.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", closeMobileMenu);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMobileMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeMobileMenu();
    });
  }

  function addMobileNavHelpers() {
    const wrap = document.querySelector(".twm-header-wrap");
    const nav = document.querySelector(".twm-nav");
    if (!wrap || !nav) return;

    wrap.classList.add("twm-header-ready");
    nav.classList.add("twm-nav-scroll");
  }

  function injectHomeCTA() {
    const path = (location.pathname || "/").toLowerCase();
    const isHome = path === "/" || path === "/index.html";
    if (!isHome) return;

    const hero =
      document.querySelector(".hero") ||
      document.querySelector(".page-hero") ||
      document.querySelector(".twm-hero") ||
      document.querySelector("section");

    if (!hero) return;
    if (hero.querySelector(".twm-home-cta-row")) return;

    const ctaRow = document.createElement("div");
    ctaRow.className = "twm-home-cta-row";
    ctaRow.innerHTML = `
      <a class="twm-home-cta twm-home-cta-primary" href="/budget-planner-calculator/">Start with Budget Planner</a>
      <a class="twm-home-cta twm-home-cta-secondary" href="/compound-interest-calculator/">Try Compound Calculator</a>
    `;

    const target =
      hero.querySelector("h1") ||
      hero.querySelector("h2") ||
      hero.firstElementChild;

    if (target && target.parentNode) {
      target.parentNode.insertBefore(ctaRow, target.nextSibling);
    } else {
      hero.appendChild(ctaRow);
    }
  }

  function afterHeaderInjected() {
    addMobileNavHelpers();
    buildMobileHeader();
    setActiveNav();
    injectHomeCTA();
  }

  async function injectHeader() {
    // If header already exists, do nothing.
    if (document.querySelector(".twm-header-wrap")) {
      afterHeaderInjected();
      return;
    }

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
      // Add class to main container if found
      const main = document.querySelector("main");
      if (main) main.classList.add("twm-page");

      afterHeaderInjected();
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

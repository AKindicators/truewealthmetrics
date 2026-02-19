// Injects the shared header into every page that loads this script.
// Put in repo root as: /header.js
//
// Expected markup on each page (top of <body>):
//   <div id="site-header"></div>
//
// This script will fetch /header.html and inject it into that div.
// If the div is missing, it will inject at the start of <body> as a fallback.

(function () {
  function normalizePath(p) {
    return (p || "/").toLowerCase().replace(/index\.html$/, "");
  }

  function setActiveNav() {
    const path = normalizePath(location.pathname || "/");

    document.querySelectorAll(".twm-pill").forEach((a) => {
      const hrefRaw = a.getAttribute("href") || "";
      const href = normalizePath(hrefRaw);

      // Home: match / and /index.html
      const isHome = href === "/" && (path === "/" || path === "");
      const isMatch = !isHome && href !== "/" && path.startsWith(href);

      if (isHome || isMatch) {
        a.classList.add("is-active");
        a.setAttribute("aria-current", "page");
      } else {
        a.classList.remove("is-active");
        a.removeAttribute("aria-current");
      }
    });
  }

  async function injectHeader() {
    // If header already exists, do nothing.
    if (document.querySelector(".twm-header-wrap")) return;

    try {
      const res = await fetch("/header.html", { cache: "no-store" });
      if (!res.ok) throw new Error("header.html not found");
      const html = await res.text();

      const mount = document.getElementById("site-header");
      if (mount) {
        mount.innerHTML = html;
      } else {
        // Fallback: insert at very top of body
        document.body.insertAdjacentHTML("afterbegin", html);
      }

      // Add consistent spacing class to main if present
      const main = document.querySelector("main");
      if (main) main.classList.add("twm-page");

      setActiveNav();
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

  // Update active state on back/forward navigation
  window.addEventListener("popstate", setActiveNav);
})();

// Injects the shared header into every page that loads this script.
// Put in repo root as: header.js

(function () {
  function setActiveNav() {
    const path = (location.pathname || "/").toLowerCase();
    document.querySelectorAll(".twm-pill").forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase();

      // match exact section by start-with (handles trailing slash)
      const isHome = href === "/" && (path === "/" || path === "/index.html");
      const isMatch = !isHome && href !== "/" && path.startsWith(href);

      if (isHome || isMatch) a.classList.add("is-active");
    });
  }

  async function injectHeader() {
    // If header already exists, do nothing.
    if (document.querySelector(".twm-header-wrap")) return;

    try {
      const res = await fetch("/header.html", { cache: "no-store" });
      if (!res.ok) throw new Error("header.html not found");
      const html = await res.text();

      // Insert at very top of body
      document.body.insertAdjacentHTML("afterbegin", html);

      // Optional: wrap page content a bit for spacing consistency
      // Add class to main container if found
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
})();

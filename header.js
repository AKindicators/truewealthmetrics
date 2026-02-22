// Injects the shared header into every page that loads this script.
// Put in repo root as: header.js

(function () {

  // Cache-bust stylesheet (forces browsers/CDN to fetch latest CSS)
  (function injectLatestStyles(){
    try{
      const id = "twm-style-bust";
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      // Update this version string when you change styles.css
      link.href = "/styles.css?v=20260222";
      document.head.appendChild(link);
    }catch(e){}
  })();


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

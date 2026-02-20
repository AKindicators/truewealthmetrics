// Injects the shared header into every page that loads this script.
// Put in repo root as: header.js

(function () {
  function normalizePath(p) {
    const s = (p || "/").toLowerCase();
    // ensure trailing slash for consistent matching (except root)
    if (s === "/" || s === "/index.html") return "/";
    return s.endsWith("/") ? s : s + "/";
  }

  function setActiveNav() {
    const path = normalizePath(location.pathname);

    const pills = Array.from(document.querySelectorAll(".twm-pill"));

    // Clear any existing active states (prevents double-active)
    pills.forEach((a) => a.classList.remove("is-active"));

    // Find the best match (longest href that matches the current path)
    let best = null;
    let bestLen = -1;

    for (const a of pills) {
      const rawHref = (a.getAttribute("href") || "").toLowerCase();
      const href = normalizePath(rawHref);

      // Home match
      if (href === "/" && path === "/") {
        best = a;
        bestLen = 1;
        continue;
      }

      // Non-home match: path starts with href
      if (href !== "/" && path.startsWith(href)) {
        if (href.length > bestLen) {
          best = a;
          bestLen = href.length;
        }
      }
    }

    if (best) {
      best.classList.add("is-active");

      // Optional: scroll active pill into view on mobile
      try {
        best.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      } catch (e) {}
    }
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

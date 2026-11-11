/*! TrueWealthMetrics site script: calculator directory search and filters. No tracking. */
(function () {
  document.querySelectorAll('[data-finder]').forEach(function (finder) {
    var scope = document.querySelector(finder.getAttribute('data-finder')) || document;
    var input = finder.querySelector('input[type="search"]');
    var chips = finder.querySelectorAll('[data-filter]');
    var items = scope.querySelectorAll('[data-item]');
    var groups = scope.querySelectorAll('[data-group]');
    var empty = scope.querySelector('[data-empty]');
    var status = finder.querySelector('[data-status]');
    var active = 'all';
    function apply() {
      var q = (input && input.value || '').trim().toLowerCase();
      var shown = 0;
      items.forEach(function (el) {
        var ok = (active === 'all' || el.getAttribute('data-cat') === active) && (!q || el.getAttribute('data-search').indexOf(q) !== -1);
        el.hidden = !ok; if (ok) shown++;
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector('[data-item]:not([hidden])'); });
      if (empty) empty.hidden = shown !== 0;
      if (status) status.textContent = shown + (shown === 1 ? ' calculator' : ' calculators') + ' shown';
    }
    if (input) input.addEventListener('input', apply);
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        active = c.getAttribute('data-filter');
        chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
        apply();
      });
    });
    finder.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = scope.querySelector('[data-item]:not([hidden]) a');
      if (first && finder.hasAttribute('data-go')) window.location.href = first.href;
      else apply();
    });
    finder.hidden = false;
  });
})();

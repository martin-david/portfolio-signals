(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Hide / show personal dollar amounts (percentages and market prices stay visible)
  var hideBtn = $('#btn-hide');
  if (hideBtn) hideBtn.addEventListener('click', function () {
    var on = hideBtn.getAttribute('aria-pressed') !== 'true';
    hideBtn.setAttribute('aria-pressed', on);
    hideBtn.textContent = on ? 'Show amounts' : 'Hide amounts';
    $$('.amt').forEach(function (el) {
      if (on) { el.dataset.v = el.textContent; el.textContent = '••••'; }
      else if (el.dataset.v) { el.textContent = el.dataset.v; }
    });
  });
  var printBtn = $('#btn-print');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

  // Expand / collapse holding details
  $$('.exp').forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', !open);
      var d = document.getElementById(b.getAttribute('aria-controls'));
      if (d) d.hidden = open;
    });
  });

  // Filter rows
  var rows = $$('#panel tbody tr.row');
  var filters = { all: function () { return true; }, material: function (r) { return r.dataset.material === '1'; },
    attention: function (r) { return /^(WATCH|REVIEW)$/.test(r.dataset.verdict); } };
  $$('.chip-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.chip-btn').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      var f = filters[b.dataset.filter];
      rows.forEach(function (r) {
        var show = f(r); r.hidden = !show;
        var d = document.getElementById('d-' + r.dataset.symbol.replace(/\W/g, '_'));
        if (d && !show) d.hidden = true;
        var x = $('.exp', r); if (x && !show) x.setAttribute('aria-expanded', 'false');
      });
    });
  });

  // Sort by column
  var order = { 'HOLD · REVIEW SIZE': 0, 'HOLD': 1, 'WATCH': 2, 'REVIEW': 3, 'NO DATA': 4 };
  var dir = {};
  $$('#panel thead button').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.dataset.sort; dir[key] = !dir[key];
      var tbody = $('#panel tbody');
      var list = rows.slice().sort(function (a, c) {
        var x = key === 'verdict' ? order[a.dataset.verdict] : parseFloat(a.dataset[key]);
        var y = key === 'verdict' ? order[c.dataset.verdict] : parseFloat(c.dataset[key]);
        if (isNaN(x)) x = -1e9; if (isNaN(y)) y = -1e9;
        return dir[key] ? x - y : y - x;
      });
      list.forEach(function (r) {
        tbody.appendChild(r);
        var d = document.getElementById('d-' + r.dataset.symbol.replace(/\W/g, '_'));
        if (d) tbody.appendChild(d);
      });
      $$('#panel thead th').forEach(function (th) { th.removeAttribute('aria-sort'); });
      b.parentNode.setAttribute('aria-sort', dir[key] ? 'ascending' : 'descending');
    });
  });
})();

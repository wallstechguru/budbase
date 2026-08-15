(function () {
  var form = document.getElementById('filter-form');
  if (!form) return;

  // Auto-submit on any checkbox change.
  form.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
    cb.addEventListener('change', function () { form.submit(); });
  });

  // Filter pill dropdowns: click to open, click outside / Escape to close,
  // only one open at a time.
  var pills = Array.prototype.slice.call(document.querySelectorAll('.filter-pill'));

  function closeAllPills(except) {
    pills.forEach(function (p) {
      if (p !== except) p.classList.remove('is-open');
    });
  }

  pills.forEach(function (pill) {
    var trigger = pill.querySelector('.filter-pill__trigger');
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !pill.classList.contains('is-open');
      closeAllPills();
      if (willOpen) pill.classList.add('is-open');
    });
  });

  document.addEventListener('click', function () { closeAllPills(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllPills();
  });

  // Dual-thumb price range slider.
  var minRange = document.getElementById('price-min-range');
  var maxRange = document.getElementById('price-max-range');
  var fill = document.getElementById('price-range-fill');
  var minLabel = document.getElementById('price-min-label');
  var maxLabel = document.getElementById('price-max-label');
  var currencySymbol = (minLabel && minLabel.textContent.match(/^\D+/) || ['£'])[0];

  if (minRange && maxRange) {
    var floor = parseFloat(minRange.min);
    var ceil = parseFloat(minRange.max);

    function updateUI() {
      var minVal = Math.min(parseFloat(minRange.value), parseFloat(maxRange.value));
      var maxVal = Math.max(parseFloat(minRange.value), parseFloat(maxRange.value));
      var range = ceil - floor || 1;
      var leftPct = ((minVal - floor) / range) * 100;
      var rightPct = ((maxVal - floor) / range) * 100;
      fill.style.left = leftPct + '%';
      fill.style.width = (rightPct - leftPct) + '%';
      minLabel.textContent = currencySymbol + minVal;
      maxLabel.textContent = currencySymbol + maxVal;
    }

    minRange.addEventListener('input', function () {
      if (parseFloat(minRange.value) > parseFloat(maxRange.value)) {
        minRange.value = maxRange.value;
      }
      updateUI();
    });

    maxRange.addEventListener('input', function () {
      if (parseFloat(maxRange.value) < parseFloat(minRange.value)) {
        maxRange.value = minRange.value;
      }
      updateUI();
    });

    [minRange, maxRange].forEach(function (el) {
      el.addEventListener('change', function () { form.submit(); });
    });

    updateUI();
  }
})();

(function () {
  var currencyMatch = document.getElementById('selected-price');
  if (!currencyMatch) return;
  var currencySymbol = (currencyMatch.textContent.match(/^\D+/) || ['£'])[0];

  // Variant selection.
  var variantPills = document.querySelectorAll('.variant-pill');
  var variantInput = document.getElementById('selected-variant-id');
  var priceEl = document.getElementById('selected-price');

  variantPills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      variantPills.forEach(function (p) { p.classList.remove('is-selected'); });
      pill.classList.add('is-selected');
      variantInput.value = pill.dataset.variantId;
      priceEl.textContent = currencySymbol + parseFloat(pill.dataset.price).toFixed(2);
    });
  });

  // Quantity stepper.
  var qtyInput = document.getElementById('qty-input');
  var decreaseBtn = document.getElementById('qty-decrease');
  var increaseBtn = document.getElementById('qty-increase');

  function setQty(value) {
    qtyInput.value = Math.max(1, value);
  }

  if (decreaseBtn) decreaseBtn.addEventListener('click', function () {
    setQty((parseInt(qtyInput.value, 10) || 1) - 1);
  });
  if (increaseBtn) increaseBtn.addEventListener('click', function () {
    setQty((parseInt(qtyInput.value, 10) || 1) + 1);
  });
  qtyInput.addEventListener('change', function () {
    setQty(parseInt(qtyInput.value, 10) || 1);
  });

  // Tabs.
  var tabs = document.querySelectorAll('.product-tabs__tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      document.querySelectorAll('.product-tabs__panel').forEach(function (panel) {
        panel.hidden = panel.dataset.tabPanel !== tab.dataset.tab;
      });
    });
  });
})();

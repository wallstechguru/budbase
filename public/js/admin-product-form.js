(function () {
  var rows = document.getElementById('variant-rows');
  var addBtn = document.getElementById('add-variant-row');
  if (!rows || !addBtn) return;

  function makeRow() {
    var row = document.createElement('div');
    row.className = 'admin-variant-row';
    row.innerHTML =
      '<input type="text" name="variant_size" placeholder="e.g. 3.5g">' +
      '<input type="number" step="0.01" min="0" name="variant_price" placeholder="Price (£)">' +
      '<button type="button" class="admin-variant-remove" aria-label="Remove size">×</button>';
    return row;
  }

  addBtn.addEventListener('click', function () {
    rows.appendChild(makeRow());
  });

  rows.addEventListener('click', function (e) {
    var removeBtn = e.target.closest('.admin-variant-remove');
    if (!removeBtn) return;
    if (rows.children.length > 1) {
      removeBtn.closest('.admin-variant-row').remove();
    } else {
      removeBtn.closest('.admin-variant-row').querySelectorAll('input').forEach(function (input) {
        input.value = '';
      });
    }
  });
})();

(function () {
  var drawer = document.getElementById('cart-drawer');
  var overlay = document.getElementById('cart-drawer-overlay');
  var openBtn = document.getElementById('cart-drawer-open');
  var closeBtn = document.getElementById('cart-drawer-close');
  var body = document.getElementById('cart-drawer-body');
  var countEls = document.querySelectorAll('.cart-count');

  if (!drawer) return;

  function openDrawer() {
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
  }

  if (openBtn) openBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  function applyCartResponse(data) {
    body.innerHTML = data.html;
    countEls.forEach(function (el) { el.textContent = data.count; });
  }

  function postCart(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) { return res.json(); });
  }

  // Remove-from-cart clicks (delegated, since drawer body is re-rendered).
  body.addEventListener('click', function (e) {
    var btn = e.target.closest('.cart-drawer__item-remove');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    postCart('/cart/remove', { cart_item_id: btn.dataset.cartItemId })
      .then(applyCartResponse)
      .catch(function () { btn.disabled = false; });
  });

  // Add-to-cart forms (product detail page).
  document.querySelectorAll('.add-to-cart-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var submitBtn = form.querySelector('[type="submit"]');
      var originalText = submitBtn ? submitBtn.textContent : '';
      var variantId = form.querySelector('[name="variant_id"]').value;
      var quantity = form.querySelector('[name="quantity"]').value;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding…';
      }

      postCart('/cart/add', { variant_id: variantId, quantity: quantity })
        .then(function (data) {
          applyCartResponse(data);
          openDrawer();
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
          }
        });
    });
  });
})();

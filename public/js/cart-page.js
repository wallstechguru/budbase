(function () {
  var body = document.getElementById('cart-page-body');
  if (!body) return;

  var countEls = document.querySelectorAll('.cart-count');
  var isBusy = false;

  function applyResponse(data) {
    body.innerHTML = data.html;
    body.classList.remove('is-busy');
    isBusy = false;
    countEls.forEach(function (el) { el.textContent = data.count; });
  }

  function postCart(url, payload) {
    if (isBusy) return Promise.resolve();
    isBusy = true;
    body.classList.add('is-busy');
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ context: 'page' }, payload)),
    }).then(function (res) { return res.json(); })
      .catch(function () {
        body.classList.remove('is-busy');
        isBusy = false;
      });
  }

  function updateQuantity(cartItemId, quantity) {
    postCart('/cart/update', { cart_item_id: cartItemId, quantity: quantity }).then(applyResponse);
  }

  body.addEventListener('click', function (e) {
    if (isBusy) return;
    var decreaseBtn = e.target.closest('.cart-qty-decrease');
    var increaseBtn = e.target.closest('.cart-qty-increase');
    var removeBtn = e.target.closest('.cart-page__row-remove');

    if (decreaseBtn) {
      var input = body.querySelector('.cart-qty-input[data-cart-item-id="' + decreaseBtn.dataset.cartItemId + '"]');
      updateQuantity(decreaseBtn.dataset.cartItemId, Math.max(0, (parseInt(input.value, 10) || 1) - 1));
    } else if (increaseBtn) {
      var input2 = body.querySelector('.cart-qty-input[data-cart-item-id="' + increaseBtn.dataset.cartItemId + '"]');
      updateQuantity(increaseBtn.dataset.cartItemId, (parseInt(input2.value, 10) || 1) + 1);
    } else if (removeBtn) {
      postCart('/cart/remove', { cart_item_id: removeBtn.dataset.cartItemId }).then(applyResponse);
    }
  });

  body.addEventListener('change', function (e) {
    if (isBusy) return;
    if (e.target.classList.contains('cart-qty-input')) {
      updateQuantity(e.target.dataset.cartItemId, Math.max(0, parseInt(e.target.value, 10) || 0));
    }
  });
})();

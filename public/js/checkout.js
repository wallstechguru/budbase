(function () {
  var paymentRadios = document.querySelectorAll('input[name="payment_method"]');
  var cryptoField = document.getElementById('crypto-network-field');
  if (!paymentRadios.length || !cryptoField) return;

  function sync() {
    var selected = document.querySelector('input[name="payment_method"]:checked');
    cryptoField.hidden = !selected || selected.value !== 'crypto';
  }

  paymentRadios.forEach(function (radio) {
    radio.addEventListener('change', sync);
  });
})();

const CURRENCY_SYMBOL = '£';

function formatPrice(amount) {
  return `${CURRENCY_SYMBOL}${Number(amount).toFixed(2)}`;
}

module.exports = { formatPrice, CURRENCY_SYMBOL };

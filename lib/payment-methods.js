// Central list of accepted payment methods for manual order processing.
// Add or remove entries here to change what's offered at checkout.
module.exports = [
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    instructions: "We'll email you our bank details to complete a transfer. Your order is held until payment is received.",
  },
  {
    value: 'crypto',
    label: 'Cryptocurrency',
    instructions: "Choose a network below — we'll email you a wallet address for payment. Your order is held until payment is confirmed.",
    networks: [
      { value: 'btc', label: 'Bitcoin (BTC)' },
      { value: 'eth', label: 'Ethereum (ETH)' },
      { value: 'usdt', label: 'Tether (USDT)' },
      { value: 'usdc', label: 'USD Coin (USDC)' },
      { value: 'ltc', label: 'Litecoin (LTC)' },
    ],
  },
];

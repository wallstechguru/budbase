const express = require('express');
const { getCartSummary, addToCart, removeFromCart, updateCartItem } = require('../lib/cart');

const router = express.Router();

const PARTIAL_BY_CONTEXT = {
  drawer: 'partials/cart-drawer-items',
  page: 'partials/cart-page-items',
};

async function sendCartState(req, res, context) {
  const summary = await getCartSummary(req.sessionID);
  const partial = PARTIAL_BY_CONTEXT[context] || PARTIAL_BY_CONTEXT.drawer;

  req.app.render(partial, {
    cartItems: summary.items,
    cartSubtotal: summary.subtotal,
    formatPrice: res.locals.formatPrice,
    resolveProductImage: res.locals.resolveProductImage,
  }, (err, html) => {
    if (err) return res.status(500).json({ error: 'Failed to render cart' });
    res.json({ count: summary.count, subtotal: summary.subtotal, html });
  });
}

router.get('/', async (req, res, next) => {
  try {
    const summary = await getCartSummary(req.sessionID);
    res.render('pages/cart', { title: 'Cart', cartItems: summary.items, cartSubtotal: summary.subtotal });
  } catch (err) {
    next(err);
  }
});

router.post('/add', async (req, res, next) => {
  try {
    const variantId = parseInt(req.body.variant_id, 10);
    const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);

    if (!variantId) {
      return res.status(400).json({ error: 'variant_id is required' });
    }

    await addToCart(req.sessionID, variantId, quantity);
    await sendCartState(req, res, req.body.context);
  } catch (err) {
    next(err);
  }
});

router.post('/remove', async (req, res, next) => {
  try {
    const cartItemId = parseInt(req.body.cart_item_id, 10);
    if (!cartItemId) {
      return res.status(400).json({ error: 'cart_item_id is required' });
    }

    await removeFromCart(req.sessionID, cartItemId);
    await sendCartState(req, res, req.body.context);
  } catch (err) {
    next(err);
  }
});

router.post('/update', async (req, res, next) => {
  try {
    const cartItemId = parseInt(req.body.cart_item_id, 10);
    const quantity = parseInt(req.body.quantity, 10);

    if (!cartItemId || Number.isNaN(quantity)) {
      return res.status(400).json({ error: 'cart_item_id and quantity are required' });
    }

    await updateCartItem(req.sessionID, cartItemId, quantity);
    await sendCartState(req, res, req.body.context);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

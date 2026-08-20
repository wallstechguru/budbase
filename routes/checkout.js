const express = require('express');
const { getCartSummary } = require('../lib/cart');
const { createOrder, getOrderWithItems } = require('../lib/orders');
const { sendOrderNotification, sendOrderConfirmation } = require('../lib/mailer');
const paymentMethods = require('../lib/payment-methods');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const cart = await getCartSummary(req.sessionID);
    if (!cart.items.length) return res.redirect('/cart');

    const user = res.locals.currentUser;
    const formValues = user
      ? { full_name: [user.first_name, user.last_name].filter(Boolean).join(' '), email: user.email }
      : {};

    res.render('pages/checkout', {
      title: 'Checkout',
      cartItems: cart.items,
      cartSubtotal: cart.subtotal,
      paymentMethods,
      errors: null,
      formValues,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const cart = await getCartSummary(req.sessionID);
    if (!cart.items.length) return res.redirect('/cart');

    const { full_name, email, phone, address, payment_method, crypto_network } = req.body;

    const chosenMethod = paymentMethods.find((m) => m.value === payment_method);

    const errors = [];
    if (!full_name || !full_name.trim()) errors.push('Full name is required.');
    if (!email || !email.trim()) errors.push('Email is required.');
    if (!address || !address.trim()) errors.push('Delivery address is required.');
    if (!chosenMethod) errors.push('Choose a payment method.');
    if (chosenMethod && chosenMethod.networks && !chosenMethod.networks.some((n) => n.value === crypto_network)) {
      errors.push('Choose a crypto network.');
    }

    if (errors.length) {
      return res.status(400).render('pages/checkout', {
        title: 'Checkout',
        cartItems: cart.items,
        cartSubtotal: cart.subtotal,
        paymentMethods,
        errors,
        formValues: req.body,
      });
    }

    const order = await createOrder(req.sessionID, {
      userId: req.session.userId || null,
      full_name,
      email,
      phone,
      fulfillment_method: 'delivery',
      address,
      payment_method,
      crypto_network: chosenMethod.networks ? crypto_network : null,
    });
    req.session.lastOrderId = order.id;

    sendOrderNotification(order).catch((err) => console.error('Order notification failed:', err.message));
    sendOrderConfirmation(order).catch((err) => console.error('Order confirmation email failed:', err.message));

    res.redirect(`/checkout/confirmation/${order.id}`);
  } catch (err) {
    next(err);
  }
});

router.get('/confirmation/:id', async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (req.session.lastOrderId !== orderId) {
      return res.status(404).render('pages/checkout-confirmation', { title: 'Order Not Found', order: null, paymentMethods });
    }

    const order = await getOrderWithItems(orderId);
    if (!order) return res.status(404).render('pages/checkout-confirmation', { title: 'Order Not Found', order: null, paymentMethods });

    res.render('pages/checkout-confirmation', { title: 'Order Confirmed', order, paymentMethods });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

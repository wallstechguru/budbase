const express = require('express');
const { getFeaturedProducts } = require('../lib/catalog');
const { sendContactNotification } = require('../lib/mailer');

const router = express.Router();

const STORES = [
  {
    name: 'BudBase HQ',
    address: '412 King Street West, Toronto, ON M5V 1K1',
    hours: [
      { day: 'Monday – Saturday', time: '9:00 AM – 9:00 PM' },
      { day: 'Sunday', time: '11:00 AM – 6:00 PM' },
    ],
    phone: '(416) 555-0142',
  },
];

router.get('/rewards', (req, res) => {
  res.render('pages/rewards', { title: 'Base Rewards' });
});

router.get('/deals', async (req, res, next) => {
  try {
    const dealProducts = await getFeaturedProducts();
    res.render('pages/deals', { title: 'Deals', dealProducts });
  } catch (err) {
    next(err);
  }
});

router.get('/locations', (req, res) => {
  res.render('pages/locations', { title: 'Locations', stores: STORES });
});

router.get('/recycling', (req, res) => {
  res.render('pages/recycling', { title: 'Recycling Initiative' });
});

router.get('/contact', (req, res) => {
  res.render('pages/contact', { title: 'Contact Us', errors: null, formValues: {}, submitted: false });
});

router.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  const errors = [];
  if (!name || !name.trim()) errors.push('Name is required.');
  if (!email || !email.trim()) errors.push('Email is required.');
  if (!message || !message.trim()) errors.push('Message is required.');

  if (errors.length) {
    return res.status(400).render('pages/contact', { title: 'Contact Us', errors, formValues: req.body, submitted: false });
  }

  sendContactNotification({ name, email, message }).catch((err) => console.error('Contact notification failed:', err.message));

  res.render('pages/contact', { title: 'Contact Us', errors: null, formValues: {}, submitted: true });
});

router.get('/privacy-policy', (req, res) => {
  res.render('pages/privacy-policy', { title: 'Privacy Policy' });
});

router.get('/refund-policy', (req, res) => {
  res.render('pages/refund-policy', { title: 'Refund Policy' });
});

router.get('/shipping-policy', (req, res) => {
  res.render('pages/shipping-policy', { title: 'Shipping & Delivery Policy' });
});

router.get('/terms', (req, res) => {
  res.render('pages/terms', { title: 'Terms & Conditions' });
});

router.get('/careers', (req, res) => {
  res.render('pages/careers', { title: 'Careers' });
});

router.get('/investor-relations', (req, res) => {
  res.render('pages/investor-relations', { title: 'Investor Relations' });
});

module.exports = router;

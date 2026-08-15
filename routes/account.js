const express = require('express');
const { createUser, getUserByEmail, verifyPassword } = require('../lib/auth');
const { getOrdersForUser } = require('../lib/orders');
const { sendSignupNotification } = require('../lib/mailer');

const router = express.Router();

function requireGuest(req, res, next) {
  if (req.session.userId) return res.redirect('/account');
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/account/login');
  next();
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const orders = await getOrdersForUser(req.session.userId);
    res.render('pages/account-dashboard', { title: 'My Account', orders });
  } catch (err) {
    next(err);
  }
});

router.get('/signup', requireGuest, (req, res) => {
  res.render('pages/account-signup', { title: 'Sign Up', errors: null, formValues: {} });
});

router.post('/signup', requireGuest, async (req, res, next) => {
  try {
    const { email, password, confirm_password, first_name, last_name } = req.body;

    const errors = [];
    if (!email || !email.trim()) errors.push('Email is required.');
    if (!password || password.length < 8) errors.push('Password must be at least 8 characters.');
    if (password !== confirm_password) errors.push('Passwords do not match.');
    if (email && (await getUserByEmail(email))) errors.push('An account with that email already exists.');

    if (errors.length) {
      return res.status(400).render('pages/account-signup', { title: 'Sign Up', errors, formValues: req.body });
    }

    const user = await createUser({ email, password, firstName: first_name, lastName: last_name });
    req.session.userId = user.id;

    sendSignupNotification(user).catch((err) => console.error('Signup notification failed:', err.message));

    res.redirect('/account');
  } catch (err) {
    next(err);
  }
});

router.get('/login', requireGuest, (req, res) => {
  res.render('pages/account-login', { title: 'Log In', errors: null, formValues: {} });
});

router.post('/login', requireGuest, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = email && (await getUserByEmail(email));
    const valid = user && (await verifyPassword(user, password || ''));

    if (!valid) {
      return res.status(400).render('pages/account-login', {
        title: 'Log In',
        errors: ['Incorrect email or password.'],
        formValues: { email },
      });
    }

    req.session.userId = user.id;
    res.redirect('/account');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.userId = null;
  res.redirect('/');
});

module.exports = router;

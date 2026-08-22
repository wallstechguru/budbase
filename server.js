require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const isProduction = process.env.NODE_ENV === 'production';
const { formatPrice, CURRENCY_SYMBOL } = require('./lib/format');
const { getCartSummary } = require('./lib/cart');
const { getUserById } = require('./lib/auth');
const { getAllCategories } = require('./lib/categories');
const { ensureProductImagesBucket } = require('./lib/supabase');
const { resolveProductImage } = require('./lib/images');

const app = express();
app.set('trust proxy', 1); // Render (and most hosts) terminate HTTPS in front of the app

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'budbase-dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: isProduction,
  },
};

// In-memory sessions (the default) are fine for local dev but lose every
// cart/login on each restart or redeploy — not acceptable once this is a
// real deployed site. When DATABASE_URL is set (Render), sessions persist
// in the same Supabase Postgres database instead.
if (process.env.DATABASE_URL) {
  const pgSession = require('connect-pg-simple')(session);
  sessionConfig.store = new pgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  });
}

app.use(session(sessionConfig));

app.use(async (req, res, next) => {
  try {
    res.locals.formatPrice = formatPrice;
    res.locals.currencySymbol = CURRENCY_SYMBOL;
    res.locals.searchQuery = typeof req.query.q === 'string' ? req.query.q : '';
    res.locals.resolveProductImage = resolveProductImage;

    // SEO defaults - any route can override by passing the same key to res.render().
    res.locals.metaDescription = 'BudBase is a licensed Ontario cannabis retailer offering dried flower, vapes, pre-rolls, concentrates, and edibles with province-wide delivery.';
    res.locals.ogImage = 'https://budbase.online/images/logo.svg';
    res.locals.canonicalUrl = 'https://budbase.online' + req.originalUrl.split('?')[0];

    const [categories, cart, currentUser] = await Promise.all([
      getAllCategories(),
      getCartSummary(req.sessionID),
      req.session.userId ? getUserById(req.session.userId) : null,
    ]);

    res.locals.categories = categories;
    res.locals.cartCount = cart.count;
    res.locals.cartItems = cart.items;
    res.locals.cartSubtotal = cart.subtotal;
    res.locals.currentUser = currentUser;

    next();
  } catch (err) {
    next(err);
  }
});

app.use('/', require('./routes/sitemap'));
app.use('/', require('./routes/home'));
app.use('/', require('./routes/pages'));
app.use('/shop', require('./routes/shop'));
app.use('/product', require('./routes/product'));
app.use('/cart', require('./routes/cart'));
app.use('/checkout', require('./routes/checkout'));
app.use('/account', require('./routes/account'));
app.use('/search', require('./routes/search'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).send('Page not found');
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error on', req.method, req.originalUrl, ':', err);
  if (res.headersSent) return next(err);
  res.status(500).send(isProduction ? 'Something went wrong.' : `<pre>${(err && err.stack) || JSON.stringify(err, null, 2)}</pre>`);
});

const PORT = process.env.PORT || 3000;
ensureProductImagesBucket().finally(() => {
  app.listen(PORT, () => {
    console.log(`BudBase running at http://localhost:${PORT}`);
  });
});

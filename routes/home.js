const express = require('express');
const { getFeaturedProducts } = require('../lib/catalog');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const featuredProducts = await getFeaturedProducts(8);
    res.render('pages/home', { title: 'Home', featuredProducts });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

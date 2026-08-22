const express = require('express');
const { getFeaturedProducts } = require('../lib/catalog');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const featuredProducts = await getFeaturedProducts(8);
    res.render('pages/home', {
      title: 'Home',
      featuredProducts,
      metaDescription: 'BudBase is a licensed Ontario cannabis retailer. Shop dried flower, vapes, pre-rolls, concentrates, and edibles with province-wide delivery.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

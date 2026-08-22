const express = require('express');
const { supabase } = require('../lib/supabase');
const { getAllCategories } = require('../lib/categories');

const router = express.Router();

const SITE_URL = 'https://budbase.online';

const STATIC_PATHS = [
  '/',
  '/shop',
  '/deals',
  '/locations',
  '/recycling',
  '/rewards',
  '/contact',
  '/careers',
  '/investor-relations',
  '/privacy-policy',
  '/terms',
  '/refund-policy',
  '/shipping-policy',
];

function urlEntry(path) {
  return `  <url><loc>${SITE_URL}${path}</loc></url>`;
}

router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const [categories, { data: products, error }] = await Promise.all([
      getAllCategories(),
      supabase.from('products').select('slug'),
    ]);
    if (error) throw error;

    const urls = [
      ...STATIC_PATHS.map(urlEntry),
      ...categories.map((c) => urlEntry(`/shop/${c.slug}`)),
      ...products.map((p) => urlEntry(`/product/${p.slug}`)),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

    res.type('application/xml').send(xml);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const { supabase } = require('../lib/supabase');
const { getCategoryBySlug } = require('../lib/categories');
const { PAGE_SIZE, buildPageTokens, buildPagerQuery } = require('../lib/pagination');

const router = express.Router();

const SORT_OPTIONS = {
  featured: { label: 'Featured' },
  az: { label: 'Alphabetically, A-Z' },
  za: { label: 'Alphabetically, Z-A' },
  'price-asc': { label: 'Price, low to high' },
  'price-desc': { label: 'Price, high to low' },
  'date-new': { label: 'Date, new to old' },
  'date-old': { label: 'Date, old to new' },
};

function toArray(value) {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function toArrayOrNull(value) {
  const arr = toArray(value);
  return arr.length ? arr : null;
}

function getActiveFilters(req) {
  return {
    brand: toArray(req.query.brand),
    consumption: toArray(req.query.consumption),
    cultivar: toArray(req.query.cultivar),
    effect: toArray(req.query.effect),
    form: toArray(req.query.form),
    category: toArray(req.query.category),
    price_min: req.query.price_min || '',
    price_max: req.query.price_max || '',
  };
}

async function renderListing(req, res, category) {
  const sortKey = SORT_OPTIONS[req.query.sort] ? req.query.sort : 'featured';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const priceMin = parseFloat(req.query.price_min);
  const priceMax = parseFloat(req.query.price_max);

  const { data: rows, error } = await supabase.rpc('search_products', {
    p_category_id: category ? category.id : null,
    p_category_slugs: category ? null : toArrayOrNull(req.query.category),
    p_brand_slugs: toArrayOrNull(req.query.brand),
    p_consumption: toArrayOrNull(req.query.consumption),
    p_cultivar: toArrayOrNull(req.query.cultivar),
    p_effect: toArrayOrNull(req.query.effect),
    p_form: toArrayOrNull(req.query.form),
    p_price_min: Number.isNaN(priceMin) ? null : priceMin,
    p_price_max: Number.isNaN(priceMax) ? null : priceMax,
    p_sort: sortKey,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;

  const total = rows.length ? Number(rows[0].total_count) : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: facets, error: facetsError } = await supabase.rpc('get_shop_facets', {
    p_category_id: category ? category.id : null,
  });
  if (facetsError) throw facetsError;

  const metaDescription = category
    ? `Shop ${category.name} at BudBase, a licensed Ontario cannabis retailer. Real THC/CBD potency on every product, with province-wide delivery.`
    : 'Browse BudBase\'s full cannabis catalog — dried flower, vapes, pre-rolls, concentrates, edibles, and accessories, with Ontario-wide delivery.';

  res.render('pages/shop', {
    title: category ? category.name : 'Shop All',
    heading: category ? category.name : 'Shop All Products',
    category,
    products: rows,
    total,
    page,
    totalPages,
    pageTokens: buildPageTokens(page, totalPages),
    sortKey,
    sortOptions: SORT_OPTIONS,
    facets,
    activeFilters: getActiveFilters(req),
    pagerQuery: buildPagerQuery(req.query),
    clearHref: category ? `/shop/${category.slug}` : '/shop',
    metaDescription,
    ...(category && category.tile_image ? { ogImage: `https://budbase.online/images/products/${category.tile_image}` } : {}),
  });
}

router.get('/', async (req, res, next) => {
  try {
    await renderListing(req, res, null);
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const category = await getCategoryBySlug(req.params.slug);
    if (!category) return next();
    await renderListing(req, res, category);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

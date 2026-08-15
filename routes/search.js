const express = require('express');
const { supabase } = require('../lib/supabase');
const { PAGE_SIZE, buildPageTokens, buildPagerQuery } = require('../lib/pagination');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    if (!q) {
      return res.render('pages/search', {
        title: 'Search',
        query: q,
        products: [],
        total: 0,
        page: 1,
        totalPages: 1,
        pageTokens: [],
        pagerQuery: '',
      });
    }

    const { data: rows, error } = await supabase.rpc('search_products', {
      p_query: q,
      p_sort: 'featured',
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    if (error) throw error;

    const total = rows.length ? Number(rows[0].total_count) : 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    res.render('pages/search', {
      title: `Search: ${q}`,
      query: q,
      products: rows,
      total,
      page,
      totalPages,
      pageTokens: buildPageTokens(page, totalPages),
      pagerQuery: buildPagerQuery(req.query),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

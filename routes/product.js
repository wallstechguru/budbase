const express = require('express');
const { supabase } = require('../lib/supabase');
const { resolveProductImage } = require('../lib/images');

const router = express.Router();

async function attachPriceFrom(products) {
  if (!products.length) return products;
  const { data: variants, error } = await supabase
    .from('variants')
    .select('product_id, price')
    .in('product_id', products.map((p) => p.id));
  if (error) throw error;

  const minPriceByProduct = {};
  variants.forEach((v) => {
    if (minPriceByProduct[v.product_id] === undefined || v.price < minPriceByProduct[v.product_id]) {
      minPriceByProduct[v.product_id] = v.price;
    }
  });

  return products.map(({ brands, ...p }) => ({
    ...p,
    brand_name: brands ? brands.name : null,
    price_from: minPriceByProduct[p.id],
  }));
}

router.get('/:slug', async (req, res, next) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*, brands(name, slug), categories(name, slug)')
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!product) return next();

    const { brands, categories, ...productRest } = product;
    const flatProduct = {
      ...productRest,
      brand_name: brands ? brands.name : null,
      brand_slug: brands ? brands.slug : null,
      category_name: categories ? categories.name : null,
      category_slug: categories ? categories.slug : null,
    };

    const { data: variants, error: vError } = await supabase
      .from('variants')
      .select('*')
      .eq('product_id', product.id)
      .order('price', { ascending: true });
    if (vError) throw vError;

    let relatedProducts = [];
    if (product.category_id) {
      const { data: related, error: rError } = await supabase
        .from('products')
        .select('*, brands(name)')
        .eq('category_id', product.category_id)
        .neq('id', product.id)
        .order('featured', { ascending: false })
        .order('name')
        .limit(4);
      if (rError) throw rError;

      relatedProducts = await attachPriceFrom(related);
    }

    const metaDescription = flatProduct.description
      ? flatProduct.description.slice(0, 155).trim()
      : `${flatProduct.name}${flatProduct.brand_name ? ' by ' + flatProduct.brand_name : ''} — available now at BudBase, a licensed Ontario cannabis retailer.`;

    const resolvedImage = resolveProductImage(flatProduct.image);
    const ogImage = /^https?:\/\//i.test(resolvedImage) ? resolvedImage : `https://budbase.online${resolvedImage}`;

    res.render('pages/product', {
      title: flatProduct.name,
      product: flatProduct,
      variants,
      relatedProducts,
      metaDescription,
      ogImage,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

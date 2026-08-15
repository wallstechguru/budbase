const { supabase } = require('./supabase');

async function getFeaturedProducts(limit) {
  let query = supabase
    .from('products')
    .select('*, brands(name)')
    .eq('featured', true)
    .order('name');
  if (limit) query = query.limit(limit);

  const { data: products, error } = await query;
  if (error) throw error;
  if (!products.length) return [];

  const { data: variants, error: vError } = await supabase
    .from('variants')
    .select('product_id, price')
    .in('product_id', products.map((p) => p.id));
  if (vError) throw vError;

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

module.exports = { getFeaturedProducts };

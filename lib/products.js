const { supabase } = require('./supabase');
const { slugify } = require('./slug');

async function slugExists(table, slug, excludeId) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true }).eq('slug', slug);
  if (excludeId) query = query.neq('id', excludeId);
  const { count, error } = await query;
  if (error) throw error;
  return count > 0;
}

async function uniqueProductSlug(name, excludeId) {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;
  while (await slugExists('products', slug, excludeId)) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

async function getOrCreateBrandId(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  const { data: existing, error } = await supabase
    .from('brands')
    .select('*')
    .ilike('name', trimmed)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;

  let slug = slugify(trimmed);
  let suffix = 2;
  while (await slugExists('brands', slug)) {
    slug = `${slugify(trimmed)}-${suffix++}`;
  }

  const { data: newBrand, error: insertError } = await supabase
    .from('brands')
    .insert({ name: trimmed, slug })
    .select()
    .single();
  if (insertError) throw insertError;
  return newBrand.id;
}

function toProductRow(data) {
  return {
    name: data.name,
    category_id: data.category_id,
    consumption_method: data.consumption_method || null,
    cultivar_type: data.cultivar_type || null,
    dominant_effect: data.dominant_effect || null,
    form: data.form || null,
    thc_min: data.thc_min,
    thc_max: data.thc_max,
    cbd_min: data.cbd_min,
    cbd_max: data.cbd_max,
    description: data.description || null,
    image: data.image,
    featured: !!data.featured,
  };
}

async function listProductsForAdmin() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, slug, featured, brands(name), categories(name)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: variants, error: vError } = await supabase.from('variants').select('product_id, price');
  if (vError) throw vError;

  const statsByProduct = {};
  variants.forEach((v) => {
    const s = statsByProduct[v.product_id] || { min: v.price, max: v.price, count: 0 };
    s.min = Math.min(s.min, v.price);
    s.max = Math.max(s.max, v.price);
    s.count += 1;
    statsByProduct[v.product_id] = s;
  });

  return products.map((p) => {
    const stats = statsByProduct[p.id] || { min: null, max: null, count: 0 };
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      featured: p.featured,
      brand_name: p.brands ? p.brands.name : null,
      category_name: p.categories ? p.categories.name : null,
      price_from: stats.min,
      price_to: stats.max,
      variant_count: stats.count,
    };
  });
}

async function getProductForEdit(id) {
  const { data: product, error } = await supabase
    .from('products')
    .select('*, brands(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!product) return null;

  const { data: variants, error: vError } = await supabase
    .from('variants')
    .select('*')
    .eq('product_id', id)
    .order('price', { ascending: true });
  if (vError) throw vError;

  const { brands, ...rest } = product;
  return { ...rest, brand_name: brands ? brands.name : null, variants };
}

async function createProduct(data) {
  const brand_id = await getOrCreateBrandId(data.brand_name);
  const slug = await uniqueProductSlug(data.name);

  const { data: product, error } = await supabase
    .from('products')
    .insert({ ...toProductRow(data), brand_id, slug })
    .select()
    .single();
  if (error) throw error;

  const variantRows = data.variants.map((v) => ({ product_id: product.id, size_label: v.size_label, price: v.price }));
  const { error: variantError } = await supabase.from('variants').insert(variantRows);
  if (variantError) throw variantError;

  return product.id;
}

async function updateProduct(id, data) {
  const brand_id = await getOrCreateBrandId(data.brand_name);
  const slug = await uniqueProductSlug(data.name, id);

  const { error } = await supabase
    .from('products')
    .update({ ...toProductRow(data), brand_id, slug })
    .eq('id', id);
  if (error) throw error;

  const { error: deleteError } = await supabase.from('variants').delete().eq('product_id', id);
  if (deleteError) throw deleteError;

  const variantRows = data.variants.map((v) => ({ product_id: id, size_label: v.size_label, price: v.price }));
  const { error: insertError } = await supabase.from('variants').insert(variantRows);
  if (insertError) throw insertError;
}

async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      return { success: false, error: 'This product has order history and can’t be deleted. Try unfeaturing it instead.' };
    }
    throw error;
  }
  return { success: true };
}

module.exports = {
  listProductsForAdmin,
  getProductForEdit,
  createProduct,
  updateProduct,
  deleteProduct,
};

const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { supabase } = require('./supabase');
const { createProduct, updateProduct } = require('./products');
const { getAllCategories } = require('./categories');

// One row per variant, product fields repeated on every row for that
// product — easiest to edit in a spreadsheet, and each row is
// self-contained rather than relying on "first row has the data".
const CSV_COLUMNS = [
  'product_id', 'name', 'brand', 'category', 'consumption_method', 'cultivar_type',
  'dominant_effect', 'form', 'thc_min', 'thc_max', 'cbd_min', 'cbd_max',
  'description', 'image', 'featured', 'size_label', 'price',
];

async function exportProductsCsv() {
  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id, name, description, consumption_method, cultivar_type, dominant_effect, form,
      thc_min, thc_max, cbd_min, cbd_max, image, featured,
      brands(name), categories(name)
    `)
    .order('id');
  if (error) throw error;

  const { data: variants, error: vError } = await supabase.from('variants').select('*').order('id');
  if (vError) throw vError;

  const variantsByProduct = {};
  variants.forEach((v) => {
    (variantsByProduct[v.product_id] = variantsByProduct[v.product_id] || []).push(v);
  });

  const rows = [];
  products.forEach((p) => {
    const productVariants = variantsByProduct[p.id] || [{ size_label: '', price: '' }];
    productVariants.forEach((v) => {
      rows.push({
        product_id: p.id,
        name: p.name,
        brand: p.brands ? p.brands.name : '',
        category: p.categories ? p.categories.name : '',
        consumption_method: p.consumption_method || '',
        cultivar_type: p.cultivar_type || '',
        dominant_effect: p.dominant_effect || '',
        form: p.form || '',
        thc_min: p.thc_min ?? '',
        thc_max: p.thc_max ?? '',
        cbd_min: p.cbd_min ?? '',
        cbd_max: p.cbd_max ?? '',
        description: p.description || '',
        image: p.image || '',
        featured: p.featured ? 'true' : 'false',
        size_label: v.size_label || '',
        price: v.price ?? '',
      });
    });
  });

  return stringify(rows, { header: true, columns: CSV_COLUMNS });
}

async function importProductsCsv(buffer) {
  const records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });

  const categories = await getAllCategories();
  const categoryByName = {};
  categories.forEach((c) => { categoryByName[c.name.toLowerCase()] = c.id; });

  // Group rows into one entry per product: by product_id when given
  // (updates), otherwise by name (creates). Each group's rows become
  // that product's variants.
  const groups = new Map();
  const order = [];
  records.forEach((row, i) => {
    const key = row.product_id && row.product_id.trim()
      ? `id:${row.product_id.trim()}`
      : `name:${(row.name || '').trim().toLowerCase()}`;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key).push({ row, line: i + 2 }); // +1 header row, +1 for 1-indexing
  });

  const result = { created: 0, updated: 0, errors: [] };

  for (const key of order) {
    const rows = groups.get(key);
    const first = rows[0].row;

    try {
      if (!first.name || !first.name.trim()) {
        throw new Error('Missing product name');
      }
      if (!first.category || !first.category.trim()) {
        throw new Error('Missing category');
      }
      const categoryId = categoryByName[first.category.trim().toLowerCase()];
      if (!categoryId) {
        throw new Error(`Unknown category "${first.category}" (must match an existing category name exactly)`);
      }

      const variants = rows
        .map((r) => ({ size_label: (r.row.size_label || '').trim(), price: parseFloat(r.row.price) }))
        .filter((v) => v.size_label && !Number.isNaN(v.price));
      if (!variants.length) {
        throw new Error('No valid size/price rows');
      }

      const toNullableFloat = (v) => (v === '' || v === undefined || v === null ? null : parseFloat(v));

      const data = {
        name: first.name.trim(),
        brand_name: (first.brand || '').trim(),
        category_id: categoryId,
        consumption_method: first.consumption_method || '',
        cultivar_type: first.cultivar_type || '',
        dominant_effect: first.dominant_effect || '',
        form: first.form || '',
        thc_min: toNullableFloat(first.thc_min),
        thc_max: toNullableFloat(first.thc_max),
        cbd_min: toNullableFloat(first.cbd_min),
        cbd_max: toNullableFloat(first.cbd_max),
        description: first.description || '',
        image: (first.image || '').trim() || 'flower.svg',
        featured: /^(true|1|yes)$/i.test(first.featured || ''),
        variants,
      };

      const productId = first.product_id && first.product_id.trim();
      if (productId) {
        await updateProduct(productId, data);
        result.updated += 1;
      } else {
        await createProduct(data);
        result.created += 1;
      }
    } catch (err) {
      result.errors.push(`Row ${rows[0].line} (${first.name || 'unnamed'}): ${err.message}`);
    }
  }

  return result;
}

module.exports = { exportProductsCsv, importProductsCsv, CSV_COLUMNS };

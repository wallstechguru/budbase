require('dotenv').config();
const { supabase } = require('../lib/supabase');
const { slugify } = require('../lib/slug');

const brands = [
  'Northfield Farms',
  'Sundown Cultivars',
  'Cascade Cannabis Co.',
  'Greenline',
  'Solstice Gardens',
  'Bear Creek',
];

const categories = [
  { name: 'Dried Flower', image: 'flower.svg' },
  { name: 'Pre-Rolls', image: 'prerolls.svg' },
  { name: 'Vapes', image: 'vape.svg' },
  { name: 'Concentrates', image: 'concentrate.svg' },
  { name: 'Edibles', image: 'edible.svg' },
  { name: 'Big Bags', image: 'bigbag.svg' },
];

const products = [
  // Dried Flower
  {
    name: 'Pink Kush', category: 'Dried Flower', brand: 'Northfield Farms',
    consumption_method: 'Smoke', cultivar_type: 'Indica', dominant_effect: 'Relaxed', form: 'Dried Flower',
    thc: [24, 30], cbd: [0, 1], featured: 1,
    description: 'A dense, resin-heavy indica with a sweet, floral finish. A slow-building body relaxation that settles in after a couple of hits — a solid pick for winding down at the end of the day.',
    image: 'flower.svg',
    variants: [ ['3.5g', 13.49], ['7g', 22.99], ['14g', 39.99], ['28g', 68.99] ],
  },
  {
    name: 'Blue Dream', category: 'Dried Flower', brand: 'Sundown Cultivars',
    consumption_method: 'Smoke', cultivar_type: 'Sativa', dominant_effect: 'Uplifted', form: 'Dried Flower',
    thc: [18, 24], cbd: [0, 1], featured: 1,
    description: 'A West Coast classic. Berry-forward aroma with a light, clear-headed lift that keeps you moving rather than melting into the couch.',
    image: 'flower.svg',
    variants: [ ['3.5g', 11.49], ['7g', 19.99], ['14g', 34.49], ['28g', 60.99] ],
  },
  {
    name: 'Girl Scout Cookies', category: 'Dried Flower', brand: 'Cascade Cannabis Co.',
    consumption_method: 'Smoke', cultivar_type: 'Hybrid', dominant_effect: 'Euphoric', form: 'Dried Flower',
    thc: [20, 26], cbd: [0, 1], featured: 0,
    description: 'Earthy and sweet with a peppery edge. Balanced hybrid effects — enough head lift to stay social, enough body ease to stay comfortable.',
    image: 'flower.svg',
    variants: [ ['3.5g', 12.99], ['7g', 22.49], ['14g', 38.99] ],
  },
  {
    name: 'Wedding Cake', category: 'Dried Flower', brand: 'Bear Creek',
    consumption_method: 'Smoke', cultivar_type: 'Hybrid', dominant_effect: 'Relaxed', form: 'Dried Flower',
    thc: [22, 28], cbd: [0, 1], featured: 1,
    description: 'Rich, tangy, almost vanilla-sweet on the exhale. Leans indica in effect — a heavy-lidded calm without being fully sedated.',
    image: 'flower.svg',
    variants: [ ['3.5g', 14.49], ['7g', 24.99], ['14g', 43.99] ],
  },
  {
    name: 'Gelato', category: 'Dried Flower', brand: 'Solstice Gardens',
    consumption_method: 'Smoke', cultivar_type: 'Hybrid', dominant_effect: 'Happy', form: 'Dried Flower',
    thc: [19, 25], cbd: [0, 1], featured: 0,
    description: 'Dessert-y and smooth, with a mellow, even-keeled high that fits comfortably into an afternoon.',
    image: 'flower.svg',
    variants: [ ['3.5g', 11.99], ['7g', 21.49], ['14g', 36.99] ],
  },
  // Pre-Rolls
  {
    name: 'OG Kush Pre-Roll 5-Pack', category: 'Pre-Rolls', brand: 'Northfield Farms',
    consumption_method: 'Smoke', cultivar_type: 'Indica', dominant_effect: 'Relaxed', form: 'Pre-Roll',
    thc: [20, 26], cbd: [0, 1], featured: 1,
    description: 'Five 0.5g pre-rolls, ground and packed for an even burn. Grab-and-go convenience with the classic OG profile.',
    image: 'prerolls.svg',
    variants: [ ['5 x 0.5g', 15.49] ],
  },
  {
    name: 'Sour Diesel Pre-Roll 3-Pack', category: 'Pre-Rolls', brand: 'Greenline',
    consumption_method: 'Smoke', cultivar_type: 'Sativa', dominant_effect: 'Energetic', form: 'Pre-Roll',
    thc: [18, 23], cbd: [0, 1], featured: 0,
    description: 'Sharp, fuel-forward aroma and a fast-acting, energizing lift. Three 0.5g pre-rolls per pack.',
    image: 'prerolls.svg',
    variants: [ ['3 x 0.5g', 10.49] ],
  },
  // Vapes
  {
    name: 'Mango Haze 510 Cartridge', category: 'Vapes', brand: 'Cascade Cannabis Co.',
    consumption_method: 'Smoke/Vape', cultivar_type: 'Sativa', dominant_effect: 'Uplifted', form: '510 Cartridge',
    thc: [80, 85], cbd: [0, 1], featured: 1,
    description: 'A tropical, mango-forward distillate cart with a bright, energizing lift. Compatible with standard 510 batteries.',
    image: 'vape.svg',
    variants: [ ['0.5g', 18.49], ['1g', 29.49] ],
  },
  {
    name: 'Grape Ape Disposable Vape', category: 'Vapes', brand: 'Bear Creek',
    consumption_method: 'Smoke/Vape', cultivar_type: 'Indica', dominant_effect: 'Sleepy', form: 'Disposable',
    thc: [78, 84], cbd: [0, 1], featured: 0,
    description: 'A ready-to-use disposable with a grape-and-berry profile and a heavy, sleepy-time effect. No charging, no refills.',
    image: 'vape.svg',
    variants: [ ['1g', 21.49] ],
  },
  {
    name: 'Tropic Thunder AIO', category: 'Vapes', brand: 'Solstice Gardens',
    consumption_method: 'Smoke/Vape', cultivar_type: 'Hybrid', dominant_effect: 'Happy', form: 'AIO',
    thc: [82, 88], cbd: [0, 1], featured: 1,
    description: 'All-in-one pod device with a juicy tropical blend. Balanced, easygoing effect suited to daytime or evening use.',
    image: 'vape.svg',
    variants: [ ['1g', 23.99] ],
  },
  // Concentrates
  {
    name: 'Death Bubba Shatter', category: 'Concentrates', brand: 'Northfield Farms',
    consumption_method: 'Smoke/Vape', cultivar_type: 'Indica', dominant_effect: 'Relaxed', form: 'Shatter',
    thc: [75, 82], cbd: [0, 1], featured: 0,
    description: 'Glassy, stable shatter with an earthy, kush-forward flavour. Deep, heavy relaxation for experienced users.',
    image: 'concentrate.svg',
    variants: [ ['1g', 15.99] ],
  },
  {
    name: 'Lemon Haze Live Rosin', category: 'Concentrates', brand: 'Sundown Cultivars',
    consumption_method: 'Smoke/Vape', cultivar_type: 'Sativa', dominant_effect: 'Focused', form: 'Rosin',
    thc: [70, 78], cbd: [0, 1], featured: 1,
    description: 'Solventless, fresh-frozen rosin with a sharp citrus nose. Clear, focused energy without the heaviness.',
    image: 'concentrate.svg',
    variants: [ ['1g', 23.99] ],
  },
  {
    name: 'Bubble Hash', category: 'Concentrates', brand: 'Greenline',
    consumption_method: 'Smoke/Vape', cultivar_type: 'Hybrid', dominant_effect: 'Euphoric', form: 'Hash',
    thc: [45, 55], cbd: [0, 1], featured: 0,
    description: 'Traditional ice-water hash, hand-pressed. Smooth smoke and a gentle, well-rounded euphoria.',
    image: 'concentrate.svg',
    variants: [ ['1g', 10.49], ['3.5g', 31.99] ],
  },
  // Edibles
  {
    name: 'Mixed Berry Gummies 10-Pack', category: 'Edibles', brand: 'Cascade Cannabis Co.',
    consumption_method: 'Ingest', cultivar_type: 'Hybrid', dominant_effect: 'Happy', form: 'Gummy',
    thc: [null, null], cbd: [0, 1], featured: 1,
    description: 'Ten 10mg THC gummies in a mixed berry blend. Precisely dosed for a predictable, easygoing edible experience.',
    image: 'edible.svg',
    variants: [ ['10 x 10mg', 11.99] ],
  },
  {
    name: 'Dark Chocolate Bar', category: 'Edibles', brand: 'Bear Creek',
    consumption_method: 'Ingest', cultivar_type: 'Hybrid', dominant_effect: 'Relaxed', form: 'Chocolate',
    thc: [null, null], cbd: [0, 1], featured: 0,
    description: 'Rich 70% dark chocolate, scored into 10mg squares. Slow onset, long, mellow effect.',
    image: 'edible.svg',
    variants: [ ['10 x 10mg', 9.99] ],
  },
  {
    name: 'Sparkling Watermelon Beverage', category: 'Edibles', brand: 'Solstice Gardens',
    consumption_method: 'Ingest', cultivar_type: 'Hybrid', dominant_effect: 'Uplifted', form: 'Beverage',
    thc: [null, null], cbd: [0, 1], featured: 0,
    description: 'A light, fast-acting 5mg THC sparkling drink. Crisp watermelon flavour, nothing syrupy about it.',
    image: 'edible.svg',
    variants: [ ['355ml can', 3.49] ],
  },
  // Big Bags
  {
    name: 'Value Blend Milled Flower 28g', category: 'Big Bags', brand: 'Greenline',
    consumption_method: 'Smoke', cultivar_type: 'Hybrid', dominant_effect: 'Relaxed', form: 'Milled Flower',
    thc: [18, 22], cbd: [0, 1], featured: 1,
    description: 'A pre-milled hybrid blend in a bulk 28g bag — built for value and ready to roll straight out of the bag.',
    image: 'bigbag.svg',
    variants: [ ['28g', 47.99] ],
  },
  {
    name: 'House Blend Shake 28g', category: 'Big Bags', brand: 'Northfield Farms',
    consumption_method: 'Smoke', cultivar_type: 'Indica', dominant_effect: 'Sleepy', form: 'Dried Flower',
    thc: [15, 20], cbd: [0, 1], featured: 0,
    description: 'Trim and shake from our indica harvests, bagged in bulk. Budget-friendly and no-frills.',
    image: 'bigbag.svg',
    variants: [ ['28g', 39.99] ],
  },
];

async function clearAll() {
  const tables = ['order_items', 'orders', 'cart_items', 'variants', 'products', 'categories', 'brands'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', 0);
    if (error) throw error;
  }
}

async function seed() {
  await clearAll();

  const { data: insertedBrands, error: brandError } = await supabase
    .from('brands')
    .insert(brands.map((name) => ({ name, slug: slugify(name) })))
    .select();
  if (brandError) throw brandError;
  const brandIds = Object.fromEntries(insertedBrands.map((b) => [b.name, b.id]));

  const { data: insertedCategories, error: catError } = await supabase
    .from('categories')
    .insert(categories.map((c) => ({ name: c.name, slug: slugify(c.name), tile_image: c.image })))
    .select();
  if (catError) throw catError;
  const categoryIds = Object.fromEntries(insertedCategories.map((c) => [c.name, c.id]));

  for (const p of products) {
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        name: p.name,
        slug: slugify(p.name),
        brand_id: brandIds[p.brand],
        category_id: categoryIds[p.category],
        consumption_method: p.consumption_method,
        cultivar_type: p.cultivar_type,
        dominant_effect: p.dominant_effect,
        form: p.form,
        thc_min: p.thc[0],
        thc_max: p.thc[1],
        cbd_min: p.cbd[0],
        cbd_max: p.cbd[1],
        description: p.description,
        image: p.image,
        featured: !!p.featured,
      })
      .select()
      .single();
    if (productError) throw productError;

    const variantRows = p.variants.map(([size_label, price], i) => ({
      product_id: product.id,
      size_label,
      price,
      sku: `${slugify(p.name)}-${i}`,
      in_stock: true,
    }));
    const { error: variantError } = await supabase.from('variants').insert(variantRows);
    if (variantError) throw variantError;
  }

  console.log(`Seeded ${brands.length} brands, ${categories.length} categories, ${products.length} products.`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

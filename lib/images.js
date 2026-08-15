const path = require('path');
const { supabase, PRODUCT_IMAGES_BUCKET } = require('./supabase');

// Existing seeded products still reference the local placeholder filenames
// (e.g. "flower.svg"); newly admin-uploaded images are full Supabase Storage
// URLs. This lets both render correctly without needing to migrate old rows.
function resolveProductImage(image) {
  if (!image) return '/images/products/flower.svg';
  if (/^https?:\/\//i.test(image)) return image;
  return `/images/products/${image}`;
}

async function uploadProductImage(file) {
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

module.exports = { resolveProductImage, uploadProductImage };

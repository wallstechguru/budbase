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

// Downloads an image from a supplier-provided URL and re-hosts it in our
// own Storage bucket, so the product doesn't depend on (or hotlink) the
// supplier's own server.
async function uploadProductImageFromUrl(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) throw new Error(`not an image (${contentType || 'unknown type'})`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const urlExt = path.extname(new URL(url).pathname);
    const ext = urlExt || (contentType.includes('png') ? '.png' : '.jpg');
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    const { error } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(filename, buffer, { contentType, upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { resolveProductImage, uploadProductImage, uploadProductImageFromUrl };

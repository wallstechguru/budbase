const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PRODUCT_IMAGES_BUCKET = 'product-images';

async function ensureProductImagesBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Failed to list Supabase storage buckets:', listError.message);
    return;
  }

  if (buckets.some((b) => b.name === PRODUCT_IMAGES_BUCKET)) return;

  const { error: createError } = await supabase.storage.createBucket(PRODUCT_IMAGES_BUCKET, {
    public: true,
  });
  if (createError) {
    console.error('Failed to create product-images bucket:', createError.message);
  } else {
    console.log(`Created Supabase storage bucket "${PRODUCT_IMAGES_BUCKET}".`);
  }
}

module.exports = { supabase, PRODUCT_IMAGES_BUCKET, ensureProductImagesBucket };

const express = require('express');
const multer = require('multer');
const { listProductsForAdmin, getProductForEdit, createProduct, updateProduct, deleteProduct } = require('../lib/products');
const { uploadProductImage } = require('../lib/images');
const { getAllCategories } = require('../lib/categories');
const { getAllOrders, getOrderWithItems, updateOrderStatus, ORDER_STATUSES } = require('../lib/orders');
const { exportProductsCsv, importProductsCsv } = require('../lib/products-csv');
const { convertShopifyCsv, toCsv, hydrateImages } = require('../lib/shopify-csv');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.redirect('/account/login');
  if (!res.locals.currentUser || !res.locals.currentUser.is_admin) {
    return res.status(403).send('Admins only.');
  }
  next();
}

router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    res.render('pages/admin-dashboard', {
      title: 'Admin',
      products: await listProductsForAdmin(),
      deleted: req.query.deleted === '1',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/products/new', async (req, res, next) => {
  try {
    res.render('pages/admin-product-form', {
      title: 'Add Product',
      product: null,
      categories: await getAllCategories(),
      errors: null,
      notice: null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/products/export.csv', async (req, res, next) => {
  try {
    const csv = await exportProductsCsv();
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="budbase-products-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get('/products/import', (req, res) => {
  res.render('pages/admin-import', { title: 'Import Products', result: null, error: null });
});

router.post('/products/import', uploadCsv.single('csv_file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).render('pages/admin-import', { title: 'Import Products', result: null, error: 'Choose a CSV file to upload.' });
    }
    const result = await importProductsCsv(req.file.buffer);
    res.render('pages/admin-import', { title: 'Import Products', result, error: null });
  } catch (err) {
    if (err.message && /Invalid Record Length|Invalid Opening Quote/.test(err.message)) {
      return res.status(400).render('pages/admin-import', {
        title: 'Import Products',
        result: null,
        error: `Couldn't parse that file as CSV: ${err.message}`,
      });
    }
    next(err);
  }
});

router.get('/products/import-shopify', (req, res) => {
  res.render('pages/admin-import-shopify', { title: 'Import from Shopify CSV', result: null, error: null, started: false });
});

// Runs the conversion + image downloads + import without the request
// waiting on it — a real supplier catalog can mean hundreds of external
// image fetches, easily past any reasonable HTTP timeout. Progress and the
// final tally go to the server log instead of the response.
router.post('/products/import-shopify', uploadCsv.single('csv_file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).render('pages/admin-import-shopify', { title: 'Import from Shopify CSV', result: null, error: 'Choose a CSV file to upload.', started: false });
    }
    const { rows, skipped } = await convertShopifyCsv(req.file.buffer);
    if (!rows.length) {
      return res.status(400).render('pages/admin-import-shopify', {
        title: 'Import from Shopify CSV',
        result: null,
        error: 'No usable rows found. Check the file has title/category/vendor/price columns.',
        started: false,
      });
    }

    res.render('pages/admin-import-shopify', { title: 'Import from Shopify CSV', result: null, error: null, started: true, rowCount: rows.length });

    (async () => {
      console.log(`[import-shopify] starting: ${rows.length} product(s), fetching images...`);
      const imageNotes = await hydrateImages(rows, {
        onProgress: (done, total) => {
          if (done % 25 === 0 || done === total) console.log(`[import-shopify] images: ${done}/${total}`);
        },
      });
      const result = await importProductsCsv(Buffer.from(toCsv(rows), 'utf8'));
      const allNotes = skipped.concat(imageNotes, result.errors);
      console.log(`[import-shopify] done: ${result.created} created, ${result.updated} updated, ${allNotes.length} note(s)`);
      allNotes.forEach((note) => console.log(`[import-shopify]   - ${note}`));
    })().catch((err) => console.error('[import-shopify] background job failed:', err));
  } catch (err) {
    if (err.message && /Invalid Record Length|Invalid Opening Quote/.test(err.message)) {
      return res.status(400).render('pages/admin-import-shopify', {
        title: 'Import from Shopify CSV',
        result: null,
        error: `Couldn't parse that file as CSV: ${err.message}`,
        started: false,
      });
    }
    next(err);
  }
});

router.get('/products/:id/edit', async (req, res, next) => {
  try {
    const product = await getProductForEdit(req.params.id);
    if (!product) return res.status(404).send('Product not found.');

    let notice = null;
    if (req.query.created === '1') notice = 'Product created.';
    else if (req.query.saved === '1') notice = 'Changes saved.';
    else if (req.query.error) notice = req.query.error;

    res.render('pages/admin-product-form', {
      title: `Edit ${product.name}`,
      product,
      categories: await getAllCategories(),
      errors: null,
      notice,
    });
  } catch (err) {
    next(err);
  }
});

// Parses the form into the same shape as a DB product row (snake_case),
// so the form template can pre-fill identically whether it's showing a
// freshly-submitted (possibly invalid) form or an existing DB record.
// `image` is resolved by the caller (may involve an async upload), so it's
// passed in separately rather than read from the raw form body here.
function parseProductForm(body, image) {
  const sizeLabels = [].concat(body.variant_size || []);
  const prices = [].concat(body.variant_price || []);
  const variants = sizeLabels
    .map((sizeLabel, i) => ({ size_label: (sizeLabel || '').trim(), price: parseFloat(prices[i]) }))
    .filter((v) => v.size_label && !Number.isNaN(v.price));

  return {
    name: (body.name || '').trim(),
    brand_name: (body.brand_name || '').trim(),
    category_id: parseInt(body.category_id, 10) || null,
    consumption_method: body.consumption_method || '',
    cultivar_type: body.cultivar_type || '',
    dominant_effect: body.dominant_effect || '',
    form: body.form || '',
    thc_min: body.thc_min === '' ? null : parseFloat(body.thc_min),
    thc_max: body.thc_max === '' ? null : parseFloat(body.thc_max),
    cbd_min: body.cbd_min === '' ? null : parseFloat(body.cbd_min),
    cbd_max: body.cbd_max === '' ? null : parseFloat(body.cbd_max),
    description: body.description || '',
    image: image || '',
    featured: body.featured === 'on' ? 1 : 0,
    variants: variants.length ? variants : [{}],
  };
}

function validateProductForm(data) {
  const errors = [];
  if (!data.name) errors.push('Product name is required.');
  if (!data.category_id) errors.push('Choose a category.');
  if (!data.image) errors.push('Upload a product image.');
  if (!data.variants.some((v) => v.size_label)) errors.push('Add at least one size/price.');
  return errors;
}

router.post('/products', upload.single('image_file'), async (req, res, next) => {
  try {
    const image = req.file ? await uploadProductImage(req.file) : '';
    const data = parseProductForm(req.body, image);
    const errors = validateProductForm(data);

    if (errors.length) {
      return res.status(400).render('pages/admin-product-form', {
        title: 'Add Product',
        product: data,
        categories: await getAllCategories(),
        errors,
        notice: null,
      });
    }

    const id = await createProduct(data);
    res.redirect(`/admin/products/${id}/edit?created=1`);
  } catch (err) {
    next(err);
  }
});

router.post('/products/:id', upload.single('image_file'), async (req, res, next) => {
  try {
    const image = req.file ? await uploadProductImage(req.file) : req.body.current_image;
    const data = parseProductForm(req.body, image);
    const errors = validateProductForm(data);

    if (errors.length) {
      return res.status(400).render('pages/admin-product-form', {
        title: 'Edit Product',
        product: { id: req.params.id, ...data },
        categories: await getAllCategories(),
        errors,
        notice: null,
      });
    }

    await updateProduct(req.params.id, data);
    res.redirect(`/admin/products/${req.params.id}/edit?saved=1`);
  } catch (err) {
    next(err);
  }
});

router.post('/products/:id/delete', async (req, res, next) => {
  try {
    const result = await deleteProduct(req.params.id);
    if (!result.success) {
      return res.redirect(`/admin/products/${req.params.id}/edit?error=${encodeURIComponent(result.error)}`);
    }
    res.redirect('/admin?deleted=1');
  } catch (err) {
    next(err);
  }
});

router.get('/orders', async (req, res, next) => {
  try {
    res.render('pages/admin-orders', { title: 'Orders', orders: await getAllOrders() });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await getOrderWithItems(req.params.id);
    if (!order) return res.status(404).send('Order not found.');

    res.render('pages/admin-order-detail', {
      title: `Order #${order.id}`,
      order,
      statuses: ORDER_STATUSES,
      notice: req.query.saved === '1' ? 'Status updated.' : null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:id/status', async (req, res, next) => {
  try {
    await updateOrderStatus(req.params.id, req.body.status);
    res.redirect(`/admin/orders/${req.params.id}?saved=1`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

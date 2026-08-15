const express = require('express');
const multer = require('multer');
const { listProductsForAdmin, getProductForEdit, createProduct, updateProduct, deleteProduct } = require('../lib/products');
const { uploadProductImage } = require('../lib/images');
const { getAllCategories } = require('../lib/categories');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
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

module.exports = router;

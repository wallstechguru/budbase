const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { CSV_COLUMNS } = require('./products-csv');

// Maps a Shopify product-export CSV (id, handle, title, category, vendor,
// product_type, tags, price, compare_at_price, available, image, thc_min,
// thc_max, thc_unit, cbd_min, cbd_max, cbd_unit) into our own import format.
// Images are intentionally never carried over — every converted row gets a
// blank image, so the importer falls back to the generic placeholder and
// nothing gets hotlinked from someone else's CDN.

const CATEGORY_MAP = {
  flower: null, // resolved by product_type below
  vapes: 'Vapes',
  edibles: 'Edibles',
  concentrates: 'Concentrates',
};

function mapCategory(category, productType) {
  const cat = (category || '').trim().toLowerCase();
  const type = (productType || '').trim().toLowerCase();
  if (cat === 'flower') {
    return type.includes('pre-roll') ? 'Pre-Rolls' : 'Dried Flower';
  }
  return CATEGORY_MAP[cat] || '';
}

function mapConsumptionMethod(productType) {
  const type = (productType || '').trim().toLowerCase();
  if (type.includes('pre-roll') || type.includes('dried flower')) return 'Smoke';
  if (type.includes('vape') || type.includes('cartridge')) return 'Vape';
  if (['soft chews & candy', 'chocolate', 'beverages', 'baked goods'].includes(type)) return 'Ingest';
  if (['shatter & more', 'hash & kief', 'resin', 'rosin'].includes(type)) return 'Smoke/Dab';
  if (type === 'distillate & isolate') return 'Vape/Dab';
  return '';
}

function titleCase(str) {
  return (str || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function extractCultivar(title) {
  const m = /\((IND|S|H)\)/i.exec(title || '');
  if (!m) return '';
  const code = m[1].toUpperCase();
  if (code === 'IND') return 'Indica';
  if (code === 'S') return 'Sativa';
  if (code === 'H') return 'Hybrid';
  return '';
}

// Titles are usually "NAME (TYPE) FORM - SIZE"; fall back to a trailing
// number+unit if there's no dash, then finally just "Each".
function extractSizeLabel(title) {
  const t = (title || '').trim();
  if (!t) return 'Each';
  const dashMatch = /-\s*([0-9][^-]*)$/.exec(t);
  if (dashMatch) return dashMatch[1].trim().toLowerCase();
  const trailingMatch = /([0-9]+(\.[0-9]+)?\s*(g|mg|ml)\b.*)$/i.exec(t);
  if (trailingMatch) return trailingMatch[1].trim().toLowerCase();
  return 'Each';
}

// thc_min/thc_max in our schema are percentages; Shopify exports report
// mg/g (1% ≈ 10mg/g). Per-unit potency (mg/ea, mg/each) doesn't convert to
// a percentage, so those are left blank rather than guessed.
function toPercent(value, unit) {
  if (value === '' || value === undefined || value === null) return '';
  if ((unit || '').trim().toLowerCase() !== 'mg/g') return '';
  const n = parseFloat(value);
  if (Number.isNaN(n)) return '';
  return (n / 10).toFixed(1);
}

function convertShopifyCsv(buffer) {
  const records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });

  const seen = new Set();
  const rows = [];
  const skipped = [];

  records.forEach((row, i) => {
    const line = i + 2; // +1 header, +1 for 1-indexing
    const title = (row.title || '').trim();
    if (!title) {
      skipped.push(`Row ${line}: missing title`);
      return;
    }

    const key = title.toLowerCase();
    if (seen.has(key)) return; // same product listed per-region; keep the first occurrence
    seen.add(key);

    const category = mapCategory(row.category, row.product_type);
    if (!category) {
      skipped.push(`Row ${line} (${title}): unrecognized category "${row.category || ''}" — add manually`);
      return;
    }

    const price = parseFloat(row.price);
    if (Number.isNaN(price)) {
      skipped.push(`Row ${line} (${title}): missing/invalid price`);
      return;
    }

    rows.push({
      product_id: '',
      name: title,
      brand: (row.vendor || '').trim(),
      category,
      consumption_method: mapConsumptionMethod(row.product_type),
      cultivar_type: extractCultivar(title),
      dominant_effect: '',
      form: titleCase(row.product_type),
      thc_min: toPercent(row.thc_min, row.thc_unit),
      thc_max: toPercent(row.thc_max, row.thc_unit),
      cbd_min: toPercent(row.cbd_min, row.cbd_unit),
      cbd_max: toPercent(row.cbd_max, row.cbd_unit),
      description: '',
      image: '',
      featured: '',
      size_label: extractSizeLabel(title),
      price,
    });
  });

  return {
    csv: stringify(rows, { header: true, columns: CSV_COLUMNS }),
    converted: rows.length,
    skipped,
  };
}

module.exports = { convertShopifyCsv };

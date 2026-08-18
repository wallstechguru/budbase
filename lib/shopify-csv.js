const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { CSV_COLUMNS } = require('./products-csv');
const { uploadProductImageFromUrl } = require('./images');

// Maps a Shopify product-export CSV (id, handle, title, category, vendor,
// product_type, tags, price, compare_at_price, available, image, thc_min,
// thc_max, thc_unit, cbd_min, cbd_max, cbd_unit) into our own import format.
// The source `image` URL is carried through as-is by convertShopifyCsv;
// hydrateImages() below downloads each one and re-hosts it in our own
// Storage bucket so products never end up hotlinking a third party's CDN.

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

// Looks up a value by trying several possible header spellings
// (case/spacing/punctuation-insensitive), since export tools vary —
// e.g. a native Shopify export calls this column "Body (HTML)".
function getField(row, candidates) {
  const normalized = {};
  Object.keys(row).forEach((k) => {
    normalized[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k];
  });
  for (const candidate of candidates) {
    const key = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
    const value = normalized[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// No source description on this row — build a short one from the
// structured fields we already have, so nothing is left blank.
function buildFallbackDescription({ brand, cultivarType, form, thcMin, thcMax, cbdMin, cbdMax }) {
  const lead = cultivarType ? `A ${cultivarType.toLowerCase()}${form ? ' ' + form.toLowerCase() : ''}` : (form ? `A ${form.toLowerCase()}` : 'A product');
  let sentence = brand ? `${lead} from ${brand}.` : `${lead}.`;
  const potency = [];
  if (thcMin !== '' && thcMax !== '') potency.push(`THC ${thcMin}–${thcMax}%`);
  if (cbdMin !== '' && cbdMax !== '' && !(Number(cbdMin) === 0 && Number(cbdMax) <= 1)) potency.push(`CBD ${cbdMin}–${cbdMax}%`);
  if (potency.length) sentence += ` ${potency.join(', ')}.`;
  return sentence;
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

    const brand = (row.vendor || '').trim();
    const cultivarType = extractCultivar(title);
    const form = titleCase(row.product_type);
    const thcMin = toPercent(row.thc_min, row.thc_unit);
    const thcMax = toPercent(row.thc_max, row.thc_unit);
    const cbdMin = toPercent(row.cbd_min, row.cbd_unit);
    const cbdMax = toPercent(row.cbd_max, row.cbd_unit);

    const sourceDescription = getField(row, ['description', 'body (html)', 'body_html', 'body', 'details', 'summary']);
    const description = sourceDescription
      ? stripHtml(sourceDescription)
      : buildFallbackDescription({ brand, cultivarType, form, thcMin, thcMax, cbdMin, cbdMax });

    rows.push({
      product_id: '',
      name: title,
      brand,
      category,
      consumption_method: mapConsumptionMethod(row.product_type),
      cultivar_type: cultivarType,
      dominant_effect: '',
      form,
      thc_min: thcMin,
      thc_max: thcMax,
      cbd_min: cbdMin,
      cbd_max: cbdMax,
      description,
      image: (row.image || '').trim(),
      featured: '',
      size_label: extractSizeLabel(title),
      price,
    });
  });

  return { rows, skipped };
}

function toCsv(rows) {
  return stringify(rows, { header: true, columns: CSV_COLUMNS });
}

async function mapWithConcurrency(items, limit, fn) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

// Mutates each row's `image` in place: downloads the supplier's URL and
// replaces it with our own Storage URL, or clears it (falls back to the
// placeholder) if the fetch fails. Runs with limited concurrency since a
// large catalog can mean thousands of external requests.
async function hydrateImages(rows, { concurrency = 6, onProgress } = {}) {
  const notes = [];
  let done = 0;
  await mapWithConcurrency(rows, concurrency, async (row) => {
    const sourceUrl = row.image;
    if (sourceUrl) {
      try {
        row.image = await uploadProductImageFromUrl(sourceUrl);
      } catch (err) {
        notes.push(`${row.name}: couldn't fetch image (${err.message}) — used placeholder instead`);
        row.image = '';
      }
    }
    done += 1;
    if (onProgress) onProgress(done, rows.length);
  });
  return notes;
}

module.exports = { convertShopifyCsv, toCsv, hydrateImages };

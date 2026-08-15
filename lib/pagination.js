const PAGE_SIZE = 12;

function buildPageTokens(current, total) {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const tokens = [];
  let prev = 0;
  sorted.forEach((p) => {
    if (prev && p - prev > 1) tokens.push('...');
    tokens.push(p);
    prev = p;
  });
  return tokens;
}

function buildPagerQuery(query) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, val]) => {
    if (key === 'page') return;
    if (Array.isArray(val)) {
      val.forEach((v) => params.append(key, v));
    } else if (val !== '' && val !== undefined) {
      params.append(key, val);
    }
  });
  return params.toString();
}

module.exports = { PAGE_SIZE, buildPageTokens, buildPagerQuery };

const SITE_URL = process.env.SITE_URL || 'https://cuancrab.online';
const SITE_NAME = 'Kalkulator Premium';

const NAV_ITEMS = [
  { href: '/', label: 'Kalkulator', id: 'calculator' },
  { href: '/produk', label: 'Produk/Jasa', id: 'produk' },
  { href: '/tentang', label: 'Tentang Kami', id: 'tentang' },
  { href: '/kontak', label: 'Kontak', id: 'kontak' },
  { href: '/privasi', label: 'Privasi', id: 'privasi' },
  { href: '/syarat', label: 'Syarat', id: 'syarat' },
  { href: '/refund', label: 'Refund', id: 'refund' },
  { href: '/faq', label: 'FAQ', id: 'faq' }
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderHead({ title, description, path, jsonLd }) {
  const canonical = `${SITE_URL}${path === '/' ? '' : path}`;
  const fullTitle = path === '/' ? title : `${title} | ${SITE_NAME}`;

  const jsonLdScript = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : '';

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${escapeHtml(canonical)}">

    <meta property="og:title" content="${escapeHtml(fullTitle)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:locale" content="id_ID">
    <meta property="og:site_name" content="${SITE_NAME}">

    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    ${jsonLdScript}
  </head>`;
}

function renderHeader(activeId) {
  const navLinks = NAV_ITEMS.map((item) => {
    const activeClass = item.id === activeId ? ' active' : '';
    return `<a class="nav-link${activeClass}" href="${item.href}">${escapeHtml(item.label)}</a>`;
  }).join('\n        ');

  const brandActive = activeId === 'calculator' ? ' active' : '';

  return `<header class="site-header">
      <button id="burger-btn" class="burger-btn" type="button" aria-label="Buka menu" aria-expanded="false">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <a class="brand-btn nav-link${brandActive}" href="/">Kalkulator Premium</a>
      <nav id="site-nav" class="site-nav" aria-label="Navigasi halaman">
        ${navLinks}
      </nav>
    </header>`;
}

function renderFooter() {
  return `<footer class="site-footer">
      <p>&copy; ${new Date().getFullYear()} ${SITE_NAME} &mdash; <a href="https://cuancrab.online">cuancrab.online</a></p>
      <nav class="footer-nav" aria-label="Tautan footer">
        <a href="/privasi">Privasi</a>
        <a href="/syarat">Syarat</a>
        <a href="/refund">Refund</a>
        <a href="/kontak">Kontak</a>
      </nav>
    </footer>`;
}

export function renderContentPage({ title, description, path, activeId, h1, bodyHtml, jsonLd }) {
  return `${renderHead({ title, description, path, jsonLd })}
  <body>
    ${renderHeader(activeId)}

    <main class="content-shell" aria-label="${escapeHtml(h1)}">
      <article class="notepad-page">
        <a class="back-to-calculator nav-link" href="/">Kembali ke Kalkulator</a>
        <h1>${escapeHtml(h1)}</h1>
        ${bodyHtml}
      </article>
    </main>

    ${renderFooter()}
    <script src="/common.js"></script>
  </body>
</html>`;
}

export function getSitemapXml() {
  const pages = [
    { path: '/', priority: '1.0', changefreq: 'weekly' },
    { path: '/produk', priority: '0.8', changefreq: 'monthly' },
    { path: '/tentang', priority: '0.7', changefreq: 'monthly' },
    { path: '/kontak', priority: '0.7', changefreq: 'monthly' },
    { path: '/privasi', priority: '0.5', changefreq: 'yearly' },
    { path: '/syarat', priority: '0.5', changefreq: 'yearly' },
    { path: '/refund', priority: '0.5', changefreq: 'yearly' },
    { path: '/faq', priority: '0.8', changefreq: 'monthly' }
  ];

  const urls = pages.map((page) => {
    const loc = `${SITE_URL}${page.path === '/' ? '' : page.path}`;
    return `  <url>
    <loc>${loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export { SITE_URL, SITE_NAME, NAV_ITEMS };

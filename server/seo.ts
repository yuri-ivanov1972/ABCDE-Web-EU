const BASE_URL = 'https://abcde.lv';
const DEFAULT_LANG = 'lv';
const SUPPORTED_LANGUAGES = ['lv', 'en'];

export interface PageMetadata {
  title?: string;
  description?: string;
  jsonLd?: object;
}

export interface ProductSeoData {
  name: string;
  nutriScoreGrade?: string | null;
  energyKcal?: number | null;
  categoryNameLv?: string | null;
  categoryNameEn?: string | null;
  store?: string;
  photoUrl?: string | null;
  quantityValue?: string | null;
  quantityUnit?: string | null;
  productId: number;
}

export interface CategorySeoData {
  nameLv: string;
  nameEn: string;
  categoryId: number;
  level: number;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseUrlPath(urlPath: string): { lang: string; cleanPath: string } {
  const pathParts = urlPath.split('?')[0].split('/').filter(Boolean);
  const lang = SUPPORTED_LANGUAGES.includes(pathParts[0]) ? pathParts[0] : DEFAULT_LANG;

  let cleanPath = '';
  if (SUPPORTED_LANGUAGES.includes(pathParts[0])) {
    cleanPath = '/' + pathParts.slice(1).join('/');
  } else {
    cleanPath = '/' + pathParts.join('/');
  }

  if (cleanPath !== '/' && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }
  if (cleanPath === '') cleanPath = '/';

  return { lang, cleanPath };
}

function generateCanonicalAndHreflang(urlPath: string): string {
  const { lang, cleanPath } = parseUrlPath(urlPath);

  const canonicalUrl = cleanPath === '/'
    ? `${BASE_URL}/${DEFAULT_LANG}`
    : `${BASE_URL}/${DEFAULT_LANG}${cleanPath}`;

  const hreflangTags = SUPPORTED_LANGUAGES.map(l => {
    const url = cleanPath === '/'
      ? `${BASE_URL}/${l}`
      : `${BASE_URL}/${l}${cleanPath}`;
    return `<link rel="alternate" hreflang="${l}" href="${url}" />`;
  });

  const xDefaultUrl = cleanPath === '/'
    ? `${BASE_URL}/${DEFAULT_LANG}`
    : `${BASE_URL}/${DEFAULT_LANG}${cleanPath}`;
  hreflangTags.push(`<link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />`);

  return `<link rel="canonical" href="${canonicalUrl}" />\n    ${hreflangTags.join('\n    ')}`;
}

export function generateProductMetadata(product: ProductSeoData, lang: string): PageMetadata {
  const isLv = lang === 'lv';
  const nutriScore = product.nutriScoreGrade ? `Nutri-Score ${product.nutriScoreGrade}` : '';
  const categoryName = isLv ? product.categoryNameLv : product.categoryNameEn;
  const storeName = product.store === 'maxima' ? 'Maxima' : 'Rimi';

  const titleParts = [product.name];
  if (nutriScore) titleParts.push(nutriScore);
  titleParts.push(isLv ? 'Pirkt veselīgāk | ABCDE.lv' : 'Buy healthier | ABCDE.lv');
  const title = titleParts.join(' | ');

  const descParts = [product.name];
  if (nutriScore) {
    descParts.push(isLv ? `${nutriScore} vērtējums` : `${nutriScore} rating`);
  }
  if (product.energyKcal != null) {
    descParts.push(isLv ? `Kalorijas: ${product.energyKcal} kcal` : `Calories: ${product.energyKcal} kcal`);
  }
  if (categoryName) {
    descParts.push(isLv ? `Kategorija: ${categoryName}` : `Category: ${categoryName}`);
  }
  descParts.push(`${isLv ? 'Veikals' : 'Store'}: ${storeName}`);
  const description = descParts.join('. ') + '.';

  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: product.name,
    description: description,
    url: `${BASE_URL}/${DEFAULT_LANG}/product/${product.productId}`,
  };

  if (product.photoUrl) {
    jsonLd.primaryImageOfPage = {
      '@type': 'ImageObject',
      url: product.photoUrl,
    };
  }

  if (product.nutriScoreGrade || product.energyKcal != null) {
    const mainEntity: any = {
      '@type': 'NutritionInformation',
    };
    if (product.energyKcal != null) {
      mainEntity.calories = `${product.energyKcal} kcal`;
    }
    if (product.nutriScoreGrade) {
      mainEntity.name = `Nutri-Score ${product.nutriScoreGrade}`;
    }
    jsonLd.mainEntity = mainEntity;
  }

  return { title, description, jsonLd };
}

export function generateCategoryMetadata(category: CategorySeoData, lang: string): PageMetadata {
  const isLv = lang === 'lv';
  const categoryName = isLv ? category.nameLv : category.nameEn;

  const title = isLv
    ? `${categoryName} - Produkti ar Nutri-Score | ABCDE.lv`
    : `${categoryName} - Products with Nutri-Score | ABCDE.lv`;

  const description = isLv
    ? `${categoryName} produktu saraksts ar Nutri-Score vērtējumiem. Salīdzini uzturvērtību un izvēlies veselīgākos produktus.`
    : `${categoryName} product list with Nutri-Score ratings. Compare nutritional values and choose healthier products.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: categoryName,
    description: description,
    url: `${BASE_URL}/${DEFAULT_LANG}/category/${category.categoryId}`,
  };

  return { title, description, jsonLd };
}

export function generateStaticPageMetadata(cleanPath: string, lang: string): PageMetadata {
  const isLv = lang === 'lv';

  switch (cleanPath) {
    case '/about-nutriscore':
      return {
        title: isLv
          ? 'Kas ir Nutri-Score? | ABCDE.lv'
          : 'What is Nutri-Score? | ABCDE.lv',
        description: isLv
          ? 'Uzzini, kas ir Nutri-Score sistēma un kā tā palīdz izvēlēties veselīgākus pārtikas produktus. ABCDE vērtējumu skaidrojums.'
          : 'Learn what the Nutri-Score system is and how it helps you choose healthier food products. ABCDE rating explanation.',
      };
    case '/ko-ed-latvija':
    case '/what-latvians-eat':
      return {
        title: isLv
          ? 'Ko ēd Latvija? Nutri-Score statistika | ABCDE.lv'
          : 'What do Latvians eat? Nutri-Score statistics | ABCDE.lv',
        description: isLv
          ? 'Statistika par Nutri-Score sadalījumu Latvijas pārtikas produktos. Rimi un Maxima produktu uzturvērtības analīze.'
          : 'Statistics on Nutri-Score distribution in Latvian food products. Nutritional analysis of Rimi and Maxima products.',
      };
    case '/about-project':
      return {
        title: isLv
          ? 'Par projektu ABCDE.lv | Veselīga pārtika'
          : 'About ABCDE.lv project | Healthy food',
        description: isLv
          ? 'ABCDE.lv misija - palīdzēt cilvēkiem izdarīt veselīgākas pārtikas izvēles, nodrošinot caurskatāmu uzturvērtības informāciju.'
          : 'ABCDE.lv mission - help people make healthier food choices by providing transparent nutritional information.',
      };
    case '/scan':
      return {
        title: isLv
          ? 'Skenēt cenu zīmi | ABCDE.lv'
          : 'Scan price tag | ABCDE.lv',
        description: isLv
          ? 'Nofotografē cenu zīmi veikalā un uzzini produkta Nutri-Score vērtējumu. Mobilā skenēšanas funkcija.'
          : 'Photograph a price tag in store and find out the product Nutri-Score rating. Mobile scanning feature.',
      };
    case '/':
      return {
        title: isLv
          ? 'ABCDE.lv - Veselīgi pārtikas produkti ar Nutri-Score'
          : 'ABCDE.lv - Healthy food products with Nutri-Score',
        description: isLv
          ? 'Meklē veselīgus pārtikas produktus ar Nutri-Score vērtējumiem. Rimi un Maxima produktu uzturvērtības salīdzināšana.'
          : 'Search for healthy food products with Nutri-Score ratings. Compare nutritional values of Rimi and Maxima products.',
      };
    default:
      return {};
  }
}

function generateBodyContent(pageData: { product?: ProductSeoData; category?: CategorySeoData }, lang: string): string {
  const isLv = lang === 'lv';

  if (pageData.product) {
    const p = pageData.product;
    const storeName = p.store === 'maxima' ? 'Maxima' : 'Rimi';
    const categoryName = isLv ? p.categoryNameLv : p.categoryNameEn;
    const nutriScore = p.nutriScoreGrade ? `Nutri-Score ${p.nutriScoreGrade}` : '';

    const rows: string[] = [];
    if (nutriScore) rows.push(`<p>${escapeHtml(nutriScore)}</p>`);
    if (p.energyKcal != null) rows.push(`<p>${isLv ? 'Enerģētiskā vērtība' : 'Energy'}: ${p.energyKcal} kcal</p>`);
    if (categoryName) rows.push(`<p>${isLv ? 'Kategorija' : 'Category'}: ${escapeHtml(categoryName)}</p>`);
    rows.push(`<p>${isLv ? 'Veikals' : 'Store'}: ${storeName}</p>`);
    if (p.quantityValue && p.quantityUnit) rows.push(`<p>${isLv ? 'Daudzums' : 'Quantity'}: ${escapeHtml(p.quantityValue)} ${escapeHtml(p.quantityUnit)}</p>`);

    return `<div id="seo-prerender"><h1>${escapeHtml(p.name)}</h1>${rows.join('')}</div>`;
  }

  if (pageData.category) {
    const c = pageData.category;
    const categoryName = isLv ? c.nameLv : c.nameEn;
    const desc = isLv
      ? `${categoryName} — produktu saraksts ar Nutri-Score vērtējumiem.`
      : `${categoryName} — product list with Nutri-Score ratings.`;
    return `<div id="seo-prerender"><h1>${escapeHtml(categoryName)}</h1><p>${escapeHtml(desc)}</p></div>`;
  }

  return '';
}

export function injectSeoTags(html: string, urlPath: string, pageData?: { product?: ProductSeoData; category?: CategorySeoData }): string {
  if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
    return html;
  }

  const { lang, cleanPath } = parseUrlPath(urlPath);
  const canonicalAndHreflang = generateCanonicalAndHreflang(urlPath);

  let metadata: PageMetadata = {};
  if (pageData?.product) {
    metadata = generateProductMetadata(pageData.product, lang);
  } else if (pageData?.category) {
    metadata = generateCategoryMetadata(pageData.category, lang);
  } else {
    metadata = generateStaticPageMetadata(cleanPath, lang);
  }

  let result = html;

  result = result.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);

  if (metadata.title) {
    result = result.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapeHtml(metadata.title)}</title>`
    );
  }

  if (metadata.description) {
    result = result.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeHtml(metadata.description)}" />`
    );
  }

  const canonicalUrl = cleanPath === '/'
    ? `${BASE_URL}/${DEFAULT_LANG}`
    : `${BASE_URL}/${DEFAULT_LANG}${cleanPath}`;

  const ogTags = `<meta property="og:url" content="${canonicalUrl}" />\n    <meta property="og:type" content="website" />`;

  let extraTags = canonicalAndHreflang + `\n    ${ogTags}`;

  if (metadata.jsonLd) {
    extraTags += `\n    <script type="application/ld+json">${JSON.stringify(metadata.jsonLd)}</script>`;
  }

  if (result.includes('</title>')) {
    result = result.replace('</title>', `</title>\n    ${extraTags}`);
  } else {
    result = result.replace('</head>', `${extraTags}\n  </head>`);
  }

  if (lang === 'en') {
    if (result.includes('</title>')) {
      result = result.replace('</title>', `</title>\n    <meta name="robots" content="noindex, follow" />`);
    }
  }

  if (pageData?.product?.photoUrl) {
    const rawUrl = pageData.product.photoUrl;
    const preloadUrl = rawUrl.includes('cloudinary.com')
      ? rawUrl.replace(/\bw_auto\b/g, 'w_600')
      : rawUrl;
    result = result.replace('</head>', `  <link rel="preload" as="image" href="${preloadUrl}" fetchpriority="high" />\n  </head>`);
  }

  if (pageData && (pageData.product || pageData.category)) {
    const bodyContent = generateBodyContent(pageData as { product?: ProductSeoData; category?: CategorySeoData }, lang);
    if (bodyContent && result.includes('<div id="root"></div>')) {
      result = result.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
    }
  }

  return result;
}

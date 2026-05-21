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

function buildProductImgUrls(rawUrl: string): { src: string; srcset: string | null } {
  if (rawUrl.includes('cloudinary.com')) {
    const base = rawUrl
      .replace(/dpr_auto,/g, '')
      .replace(/,dpr_auto/g, '');
    const makeSrc = (w: number) => base.replace(/\bw_auto\b/g, `w_${w}`).replace(/\bw_\d+\b/g, `w_${w}`);
    return {
      src: makeSrc(600),
      srcset: [300, 600, 900].map(w => `${makeSrc(w)} ${w}w`).join(', '),
    };
  }
  if (rawUrl.includes('barbora.lv')) {
    const proxyBase = `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
    return {
      src: `${proxyBase}&w=600`,
      srcset: [300, 600, 900].map(w => `${proxyBase}&w=${w} ${w}w`).join(', '),
    };
  }
  return { src: rawUrl, srcset: null };
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

    const imgHtml = p.photoUrl
      ? (() => {
          const { src, srcset } = buildProductImgUrls(p.photoUrl!);
          const srcsetAttr = srcset ? ` srcset="${escapeHtml(srcset)}" sizes="(min-width: 768px) 50vw, 100vw"` : '';
          return `<img src="${escapeHtml(src)}"${srcsetAttr} width="600" height="400" fetchpriority="high" loading="eager" alt="${escapeHtml(p.name)}" style="width:100%;max-width:600px;height:auto;display:block" />`;
        })()
      : '';
    return `<div id="seo-prerender">${imgHtml}<h1>${escapeHtml(p.name)}</h1>${rows.join('')}</div>`;
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

export function injectSeoTags(html: string, urlPath: string, pageData?: { product?: ProductSeoData; category?: CategorySeoData }, lcpImageUrl?: string | null, initialData?: { products: any[]; totalCount: number } | null, productInitialData?: any | null): string {
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

  // Inject a preload tag as early as possible in <head>.
  // By inserting before the Cloudinary preconnect (line ~30 of the static HTML),
  // the image download starts before the browser discovers the Vite-injected JS
  // bundle and CSS stylesheet — giving the image a clear bandwidth head-start.
  // Falls back to inserting before </head> if the preconnect marker is absent.
  function injectPreloadEarly(html: string, preloadTag: string): string {
    const CLOUDINARY_PRECONNECT = '<link rel="preconnect" href="https://rimibaltic-res.cloudinary.com"';
    if (html.includes(CLOUDINARY_PRECONNECT)) {
      return html.replace(CLOUDINARY_PRECONNECT, `${preloadTag}\n    ${CLOUDINARY_PRECONNECT}`);
    }
    return html.replace('</head>', `  ${preloadTag}\n  </head>`);
  }

  if (pageData?.product?.photoUrl) {
    const { src: preloadSrc, srcset: preloadSrcset } = buildProductImgUrls(pageData.product.photoUrl);
    const preloadTag = preloadSrcset
      ? `<link rel="preload" as="image" href="${escapeHtml(preloadSrc)}" imagesrcset="${escapeHtml(preloadSrcset)}" imagesizes="(min-width: 768px) 50vw, 100vw" fetchpriority="high" />`
      : `<link rel="preload" as="image" href="${escapeHtml(preloadSrc)}" fetchpriority="high" />`;
    result = injectPreloadEarly(result, preloadTag);
  }

  // Homepage LCP image preload — injected when no product-specific preload is already present
  if (!pageData?.product?.photoUrl && lcpImageUrl) {
    const rawUrl = lcpImageUrl;
    if (rawUrl.includes('cloudinary.com')) {
      const base = rawUrl
        .replace(/dpr_auto,/g, '')
        .replace(/,dpr_auto/g, '')
        .replace(/\bq_auto:low\b/g, 'q_auto');
      const makeSrc = (w: number) => base.replace(/\bw_auto\b/g, `w_${w}`).replace(/\bw_\d+\b/g, `w_${w}`);
      // Use w_450 as the href fallback: at 360 px viewport, 50 vw, DPR ≥ 2 the
      // browser selects the 450 w candidate from imagesrcset, so href must match.
      const preloadUrl = makeSrc(450);
      const srcset = [150, 300, 450].map(w => `${makeSrc(w)} ${w}w`).join(', ');
      const preloadTag = `<link rel="preload" as="image" href="${escapeHtml(preloadUrl)}" imagesrcset="${escapeHtml(srcset)}" imagesizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" fetchpriority="high" />`;
      result = injectPreloadEarly(result, preloadTag);
    } else if (rawUrl.includes('barbora.lv')) {
      const proxyBase = `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
      const preloadUrl = `${proxyBase}&w=450`;
      const srcset = [150, 300, 450].map(w => `${proxyBase}&w=${w} ${w}w`).join(', ');
      const preloadTag = `<link rel="preload" as="image" href="${escapeHtml(preloadUrl)}" imagesrcset="${escapeHtml(srcset)}" imagesizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" fetchpriority="high" />`;
      result = injectPreloadEarly(result, preloadTag);
    }
  }

  if (pageData && (pageData.product || pageData.category)) {
    const bodyContent = generateBodyContent(pageData as { product?: ProductSeoData; category?: CategorySeoData }, lang);
    if (bodyContent && result.includes('<div id="root"></div>')) {
      result = result.replace('<div id="root"></div>', `<div id="root">${bodyContent}</div>`);
    }
  }

  // Inject initial product data for homepage — React reads this to skip the first API call
  if (initialData) {
    // Strip fields not needed for the product grid to minimise HTML payload.
    // ingredient.ingredients arrays alone account for ~25 KB per 12 products.
    const slimData = {
      totalCount: initialData.totalCount,
      products: initialData.products.map((p: any) => ({
        productId: p.productId,
        name: p.name,
        slug: p.slug,
        quantityValue: p.quantityValue,
        quantityUnit: p.quantityUnit,
        store: p.store,
        externalUrl: p.externalUrl,
        photos: p.photos?.map((ph: any) => ({
          photoUrl: ph.photoUrl,
          altText: ph.altText,
          isPrimary: ph.isPrimary,
        })),
        nutrition: p.nutrition ? {
          nutriScoreGrade: p.nutrition.nutriScoreGrade,
          carbsSugars: p.nutrition.carbsSugars,
          fatSaturated: p.nutrition.fatSaturated,
          protein: p.nutrition.protein,
          salt: p.nutrition.salt,
        } : undefined,
        // Keep only counts — the full ingredients array is fetched on demand
        ingredientCard: p.ingredientCard ? {
          naturalCount: p.ingredientCard.naturalCount,
          processedCount: p.ingredientCard.processedCount,
          avoidCount: p.ingredientCard.avoidCount,
          limitCount: p.ingredientCard.limitCount,
          cautionCount: p.ingredientCard.cautionCount,
        } : undefined,
      })),
    };
    // Escape < > & so JSON can't accidentally close the script tag
    const safeJson = JSON.stringify(slimData)
      .replace(/&/g, '\\u0026')
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E');
    result = result.replace(
      '</body>',
      `<script id="__ABCDE_INITIAL_DATA__" type="application/json">${safeJson}</script>\n</body>`
    );
  }

  if (productInitialData) {
    const safeJson = JSON.stringify(productInitialData)
      .replace(/&/g, '\\u0026')
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E');
    result = result.replace(
      '</body>',
      `<script id="__ABCDE_PRODUCT_DATA__" type="application/json">${safeJson}</script>\n</body>`
    );
  }

  return result;
}

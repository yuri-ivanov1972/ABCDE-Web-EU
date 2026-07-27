import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation, Trans } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Link } from 'wouter';
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import NutriScoreBadge from '@/components/ui/nutri-score-badge';
import { NutriScoreGrade } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface IceCreamProduct {
  productId: number;
  name: string;
  slug: string;
  store: string | null;
  photoUrl: string | null;
  novaScore: number | null;
  nutriScoreGrade: string | null;
  energyKcal: number | null;
  fatTotal: number | null;
  fatSaturated: number | null;
  carbsSugars: number | null;
  protein: number | null;
  salt: number | null;
  ingredientCount: number | null;
  additiveCount: number | null;
}

interface ReportResponse {
  products: IceCreamProduct[];
  total: number;
  lastUpdated: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const NS_COLORS: Record<string, string> = {
  A: '#038141',
  B: '#85BB2F',
  C: '#FECB02',
  D: '#EE8100',
  E: '#E63E11',
};

const BASE_URL = 'https://abcde.lv';

// ── Helpers ──────────────────────────────────────────────────────────────────

function round1(n: number): string {
  return n.toFixed(1);
}

function buildPhotoSrc(url: string, width: number): string {
  if (url.includes('cloudinary.com')) {
    return url
      .replace(/dpr_auto,/g, '')
      .replace(/,dpr_auto/g, '')
      .replace(/\bq_auto:low\b/g, 'q_auto')
      .replace(/\bw_auto\b/g, `w_${width}`)
      .replace(/\bw_\d+\b/g, `w_${width}`);
  }
  return `/api/image-proxy?url=${encodeURIComponent(url)}&w=${width}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StoreBadge({ store }: { store: string | null }) {
  if (!store) return null;
  const isRimi = store === 'rimi';
  return (
    <span
      className="inline-block w-fit text-white text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ background: isRimi ? '#D33731' : '#24488B' }}
    >
      {isRimi ? 'Rimi' : 'Maxima'}
    </span>
  );
}

function ProductRow({
  rank,
  product,
  value,
  unit,
  showNutriScore = true,
}: {
  rank: number;
  product: IceCreamProduct;
  value: string;
  unit: string;
  showNutriScore?: boolean;
}) {
  const { i18n } = useTranslation(['iceCream']);
  const lang = i18n.language || 'lv';
  const grade = product.nutriScoreGrade as NutriScoreGrade | undefined;
  const photoSrc = product.photoUrl ? buildPhotoSrc(product.photoUrl, 80) : null;

  return (
    <tr className="border-t hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2 text-sm text-gray-400 font-medium w-8">{rank}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={product.name}
              width={40}
              height={40}
              className="w-10 h-10 object-contain rounded flex-shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-100 rounded flex-shrink-0" />
          )}
          <div className="flex flex-col gap-0.5 min-w-0">
            <Link
              href={`/${lang}/product/${product.slug}`}
              className="text-sm text-primary hover:underline leading-snug line-clamp-2"
            >
              {product.name}
            </Link>
            <StoreBadge store={product.store} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-sm font-semibold text-right whitespace-nowrap">
        {value} {unit}
      </td>
      {showNutriScore && (
        <td className="px-3 py-2 text-right">
          {grade ? <NutriScoreBadge score={grade} size="small" /> : <span className="text-gray-300 text-xs">—</span>}
        </td>
      )}
    </tr>
  );
}

function ProductTable({
  title,
  products,
  getValue,
  unit,
  description,
  formatValue = round1,
  columnHeader,
}: {
  title: string;
  products: IceCreamProduct[];
  getValue: (p: IceCreamProduct) => number | null;
  unit: string;
  description?: string;
  formatValue?: (v: number) => string | number;
  columnHeader?: string;
}) {
  const { t } = useTranslation(['iceCream']);
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-6">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="px-3 py-2 text-left w-8">#</th>
              <th className="px-3 py-2 text-left">{t('iceCream:table.product')}</th>
              <th className="px-3 py-2 text-right">{columnHeader ?? unit.toUpperCase()}</th>
              <th className="px-3 py-2 text-right">NS</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => {
              const v = getValue(p);
              return (
                <ProductRow
                  key={`${p.store}-${p.productId}-${i}`}
                  rank={i + 1}
                  product={p}
                  value={v !== null ? formatValue(v) : '—'}
                  unit={v !== null ? unit : ''}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border rounded-lg p-4 text-center shadow-sm">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm font-medium text-gray-700 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Custom bar label ─────────────────────────────────────────────────────────

function BarLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      dominantBaseline="middle"
      fontSize={12}
      fill="#374151"
    >
      {value}
    </text>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const IceCreamReport = () => {
  const { t, i18n } = useTranslation(['iceCream']);
  const lang = i18n.language || 'lv';
  const canonical = lang === 'en'
    ? `${BASE_URL}/en/articles/ice-cream`
    : `${BASE_URL}/lv/raksti/saldejums`;
  const categoryPath = `/${lang}/category/saldejums-un-ledus-24`;
  const dateLocale = lang === 'lv' ? 'lv-LV' : 'en-GB';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data, isLoading, error } = useQuery<ReportResponse>({
    queryKey: ['/api/reports/ice-cream'],
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <p className="text-center text-red-500">{t('iceCream:error')}</p>
      </div>
    );
  }

  const products = data.products;
  const total = products.length;

  // ── Derived stats ─────────────────────────────────────────────────────────

  const nsCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const p of products) {
    const g = p.nutriScoreGrade;
    if (g && g in nsCounts) nsCounts[g]++;
  }
  const nsChartData = ['A', 'B', 'C', 'D', 'E'].map(g => ({
    grade: g,
    count: nsCounts[g],
  }));

  const sugars = products.map(p => p.carbsSugars).filter((v): v is number => v !== null);
  const satFats = products.map(p => p.fatSaturated).filter((v): v is number => v !== null);

  const avgSugar = sugars.reduce((a, b) => a + b, 0) / sugars.length;
  const sugarsPositive = sugars.filter(v => v > 0);
  const minSugar = Math.min(...sugarsPositive);
  const maxSugar = Math.max(...sugars);
  const sugarMultiplier = Math.round(maxSugar / minSugar);
  const satFatsPositive = satFats.filter(v => v > 0);
  const avgSatFat = satFatsPositive.reduce((a, b) => a + b, 0) / satFatsPositive.length;
  const maxSatFat = Math.max(...satFats);
  const minSatFatPositive = Math.min(...satFats.filter(v => v > 0));
  const satFatMultiplier = Math.round(maxSatFat / minSatFatPositive);

  const nova4Count = products.filter(p => p.novaScore === 4).length;
  const nova4Pct = Math.round((nova4Count / total) * 100);

  const nsAbCount = (nsCounts.A ?? 0) + (nsCounts.B ?? 0);
  const nsDECount = (nsCounts.D ?? 0) + (nsCounts.E ?? 0);

  // ── Rankings ──────────────────────────────────────────────────────────────

  // Return up to 5 products from Rimi and up to 5 from Maxima from a pre-sorted array.
  function top5PerStore(sorted: IceCreamProduct[]): IceCreamProduct[] {
    const rimi = sorted.filter(p => p.store === 'rimi').slice(0, 5);
    const maxima = sorted.filter(p => p.store === 'maxima').slice(0, 5);
    return [...rimi, ...maxima];
  }

  const withSugar = products.filter(p => p.carbsSugars !== null);
  const withSatFat = products.filter(p => p.fatSaturated !== null);

  const top10LowSugar = top5PerStore(
    [...withSugar].sort((a, b) => a.carbsSugars! - b.carbsSugars!)
  );

  const top10LowSatFat = top5PerStore(
    [...withSatFat].sort((a, b) => a.fatSaturated! - b.fatSaturated!)
  );

  const withAdditives = products.filter(p => p.additiveCount !== null);

  const top10FewAdditives = top5PerStore(
    [...withAdditives].sort((a, b) => a.additiveCount! - b.additiveCount!)
  );

  const top10HighSugar = top5PerStore(
    [...withSugar].sort((a, b) => b.carbsSugars! - a.carbsSugars!)
  );

  const top10HighSatFat = top5PerStore(
    [...withSatFat].sort((a, b) => b.fatSaturated! - a.fatSaturated!)
  );

  const top10MostAdditives = top5PerStore(
    [...withAdditives].sort((a, b) => b.additiveCount! - a.additiveCount!)
  );

  return (
    <>
      <Helmet>
        <title>{t('iceCream:meta.title', { total })}</title>
        <meta name="description" content={t('iceCream:meta.description', { total })} />
        <link rel="canonical" href={canonical} />
      </Helmet>

      <main className="container mx-auto px-4 py-8 max-w-4xl">

        {/* ── Breadcrumb ── */}
        <nav className="text-xs text-gray-400 mb-4 flex gap-1 items-center">
          <Link href={`/${lang}`} className="hover:text-primary">ABCDE.lv</Link>
          <span>/</span>
          <span className="text-gray-600">{t('iceCream:breadcrumb.articles')}</span>
          <span>/</span>
          <span className="text-gray-600">{t('iceCream:breadcrumb.analysis')}</span>
        </nav>

        {/* ── Title ── */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
          {t('iceCream:title.headline')}<br />
          <span className="text-gray-600 font-normal text-2xl">
            {t('iceCream:title.subtitle', { total })}
          </span>
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {t('iceCream:dataSources')}
        </p>

        {/* ── Executive summary ── */}
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
          <h2 className="text-lg font-bold text-amber-900 mb-3">{t('iceCream:summary.heading')}</h2>
          <ul className="space-y-2 text-sm text-amber-900">
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <Trans i18nKey="iceCream:summary.total" values={{ total }} components={{ strong: <strong /> }} />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <Trans
                  i18nKey="iceCream:summary.nsDE"
                  values={{ count: nsDECount, pct: Math.round(nsDECount / total * 100), nsAb: nsAbCount }}
                  components={{ strong: <strong /> }}
                />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <Trans
                  i18nKey="iceCream:summary.nova4"
                  values={{ pct: nova4Pct, count: nova4Count, total }}
                  components={{ strong: <strong /> }}
                />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <Trans
                  i18nKey="iceCream:summary.sugar"
                  values={{ min: round1(minSugar), max: round1(maxSugar), mult: sugarMultiplier }}
                  components={{ strong: <strong /> }}
                />
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <Trans
                  i18nKey="iceCream:summary.satFat"
                  values={{ min: round1(minSatFatPositive), max: round1(maxSatFat), mult: satFatMultiplier }}
                  components={{ strong: <strong /> }}
                />
              </span>
            </li>
          </ul>
        </section>

        {/* ── Stat overview cards ── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label={t('iceCream:cards.products')} value={String(total)} />
          <StatCard
            label={t('iceCream:cards.avgSugar')}
            value={`${round1(avgSugar)} g`}
            sub={t('iceCream:cards.per100g')}
          />
          <StatCard
            label={t('iceCream:cards.avgSatFat')}
            value={`${round1(avgSatFat)} g`}
            sub={t('iceCream:cards.per100g')}
          />
          <StatCard
            label="NOVA 4"
            value={`${nova4Pct}%`}
            sub={t('iceCream:cards.nova4sub')}
          />
        </section>

        {/* ── Nutri-Score distribution ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('iceCream:nsSection.heading')}</h2>
          <div className="bg-white border rounded-lg shadow-sm p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={nsChartData}
                layout="vertical"
                margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="grade"
                  tick={{ fontSize: 14, fontWeight: 700 }}
                  width={24}
                />
                <Tooltip
                  formatter={(val: number) => [`${val} ${t('iceCream:nsSection.products')}`, '']}
                  labelFormatter={(label: string) => `Nutri-Score ${label}`}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} label={<BarLabel />}>
                  {nsChartData.map(entry => (
                    <Cell key={entry.grade} fill={NS_COLORS[entry.grade]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            {t('iceCream:nsSection.body', { total, nsDECount, nsDEPct: Math.round(nsDECount / total * 100) })}
          </p>
        </section>

        {/* ── NOVA callout ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">{t('iceCream:novaSection.heading')}</h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="bg-red-600 text-white text-xl font-bold rounded-lg px-3 py-2 shrink-0">
                NOVA 4
              </div>
              <div>
                <p className="font-semibold text-red-900 mb-1">
                  {t('iceCream:novaSection.calloutHeading', { total })}
                </p>
                <p className="text-sm text-red-800 leading-relaxed">
                  {t('iceCream:novaSection.calloutBody')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── TOP 10 low sugar ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {t('iceCream:top10LowSugar.heading')}
          </h2>
          <ProductTable
            title={t('iceCream:top10LowSugar.tableTitle')}
            products={top10LowSugar}
            getValue={p => p.carbsSugars}
            unit="g"
            description={t('iceCream:top10LowSugar.tableDesc')}
          />
          <p className="text-sm text-gray-500 mt-2">
            {t('iceCream:top10LowSugar.note')}
          </p>
        </section>

        {/* ── TOP 10 low sat fat ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {t('iceCream:top10LowSatFat.heading')}
          </h2>
          <ProductTable
            title={t('iceCream:top10LowSatFat.tableTitle')}
            products={top10LowSatFat}
            getValue={p => p.fatSaturated}
            unit="g"
            description={t('iceCream:top10LowSatFat.tableDesc')}
          />
          <p className="text-sm text-gray-500 mt-2">
            {t('iceCream:top10LowSatFat.note')}
          </p>
        </section>

        {/* ── TOP 10 few additives ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {t('iceCream:top10FewAdditives.heading')}
          </h2>
          <ProductTable
            title={t('iceCream:top10FewAdditives.tableTitle')}
            products={top10FewAdditives}
            getValue={p => p.additiveCount}
            unit=""
            columnHeader={t('iceCream:top10FewAdditives.colHeader')}
            description={t('iceCream:top10FewAdditives.tableDesc')}
            formatValue={String}
          />
          <p className="text-sm text-gray-500 mt-2">
            {t('iceCream:top10FewAdditives.note')}
          </p>
        </section>

        {/* ── Products to limit ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {t('iceCream:highValues.heading')}
          </h2>
          <p className="text-sm text-gray-600 mb-5">
            {t('iceCream:highValues.desc')}
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">{t('iceCream:highValues.highSugar')}</h3>
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b bg-gray-50">
                      <th className="px-3 py-1.5 text-left w-8">#</th>
                      <th className="px-3 py-1.5 text-left">{t('iceCream:table.product')}</th>
                      <th className="px-3 py-1.5 text-right">g/100g</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10HighSugar.map((p, i) => (
                      <ProductRow
                        key={`hs-${p.store}-${p.productId}-${i}`}
                        rank={i + 1}
                        product={p}
                        value={round1(p.carbsSugars!)}
                        unit="g"
                        showNutriScore={false}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">{t('iceCream:highValues.highSatFat')}</h3>
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b bg-gray-50">
                      <th className="px-3 py-1.5 text-left w-8">#</th>
                      <th className="px-3 py-1.5 text-left">{t('iceCream:table.product')}</th>
                      <th className="px-3 py-1.5 text-right">g/100g</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10HighSatFat.map((p, i) => (
                      <ProductRow
                        key={`hsf-${p.store}-${p.productId}-${i}`}
                        rank={i + 1}
                        product={p}
                        value={round1(p.fatSaturated!)}
                        unit="g"
                        showNutriScore={false}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">{t('iceCream:highValues.mostAdditives')}</h3>
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b bg-gray-50">
                      <th className="px-3 py-1.5 text-left w-8">#</th>
                      <th className="px-3 py-1.5 text-left">{t('iceCream:table.product')}</th>
                      <th className="px-3 py-1.5 text-right">{t('iceCream:highValues.count')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10MostAdditives.map((p, i) => (
                      <ProductRow
                        key={`ma-${p.store}-${p.productId}-${i}`}
                        rank={i + 1}
                        product={p}
                        value={p.additiveCount !== null ? String(p.additiveCount) : '—'}
                        unit=""
                        showNutriScore={false}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ── Methodology note ── */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-base font-semibold text-gray-700 mb-2">{t('iceCream:methodology.heading')}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {t('iceCream:methodology.body', { total })}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {t('iceCream:methodology.browseText')}{' '}
            <Link href={categoryPath} className="text-primary hover:underline">
              {t('iceCream:methodology.browseLink')}
            </Link>
            {t('iceCream:methodology.browseFilter')}
          </p>
          {data.lastUpdated && (
            <p className="text-xs text-gray-400 mt-4">
              {t('iceCream:lastUpdated')}: {new Date(data.lastUpdated).toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })}.
            </p>
          )}
        </section>

      </main>
    </>
  );
};

export default IceCreamReport;

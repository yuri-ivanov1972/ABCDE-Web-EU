import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
}: {
  rank: number;
  product: IceCreamProduct;
  value: string;
  unit: string;
}) {
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
              href={`/lv/product/${product.slug}`}
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
      <td className="px-3 py-2 text-right">
        {grade ? <NutriScoreBadge score={grade} size="small" /> : <span className="text-gray-300 text-xs">—</span>}
      </td>
    </tr>
  );
}

function ProductTable({
  title,
  products,
  getValue,
  unit,
  description,
}: {
  title: string;
  products: IceCreamProduct[];
  getValue: (p: IceCreamProduct) => number | null;
  unit: string;
  description?: string;
}) {
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
              <th className="px-3 py-2 text-left">Produkts</th>
              <th className="px-3 py-2 text-right">{unit.toUpperCase()}</th>
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
                  value={v !== null ? round1(v) : '—'}
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
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data, isLoading, error } = useQuery<ReportResponse>({
    queryKey: ['/api/reports/ice-cream'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const canonical = `${BASE_URL}/lv/raksti/saldejums`;

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
        <p className="text-center text-red-500">Datus ielādēt neizdevās. Mēģini vēlreiz.</p>
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
  const minSugar = Math.min(...sugars);
  const maxSugar = Math.max(...sugars);
  const avgSatFat = satFats.reduce((a, b) => a + b, 0) / satFats.length;
  const maxSatFat = Math.max(...satFats);

  const nova4Count = products.filter(p => p.novaScore === 4).length;
  const nova4Pct = Math.round((nova4Count / total) * 100);

  const nsAbCount = (nsCounts.A ?? 0) + (nsCounts.B ?? 0);
  const nsDECount = (nsCounts.D ?? 0) + (nsCounts.E ?? 0);

  // ── Rankings ──────────────────────────────────────────────────────────────

  const withSugar = products.filter(p => p.carbsSugars !== null);
  const withSatFat = products.filter(p => p.fatSaturated !== null);

  const top10LowSugar = [...withSugar]
    .sort((a, b) => a.carbsSugars! - b.carbsSugars!)
    .slice(0, 10);

  const top10LowSatFat = [...withSatFat]
    .sort((a, b) => a.fatSaturated! - b.fatSaturated!)
    .slice(0, 10);

  const withAdditives = products.filter(p => p.additiveCount !== null);

  const top10FewAdditives = [...withAdditives]
    .sort((a, b) => a.additiveCount! - b.additiveCount!)
    .slice(0, 10);

  const top10HighSugar = [...withSugar]
    .sort((a, b) => b.carbsSugars! - a.carbsSugars!)
    .slice(0, 10);

  const top10HighSatFat = [...withSatFat]
    .sort((a, b) => b.fatSaturated! - a.fatSaturated!)
    .slice(0, 10);

  const top10MostAdditives = [...withAdditives]
    .sort((a, b) => b.additiveCount! - a.additiveCount!)
    .slice(0, 10);

  return (
    <>
      <Helmet>
        <title>{`Veselīgākais saldējums Latvijā? Analīze: ${total} produkti | ABCDE.lv`}</title>
        <meta name="description" content={`Analizēti ${total} saldējumi no Rimi un Maxima Latvijā. Nutri-Score sadalījums, cukura un tauku salīdzinājums, TOP 10 ar mazāko cukuru un piedevām. Uzzini, kuru saldējumu pirkt.`} />
        <link rel="canonical" href={canonical} />
      </Helmet>

      <main className="container mx-auto px-4 py-8 max-w-4xl">

        {/* ── Breadcrumb ── */}
        <nav className="text-xs text-gray-400 mb-4 flex gap-1 items-center">
          <Link href="/lv" className="hover:text-primary">ABCDE.lv</Link>
          <span>/</span>
          <span className="text-gray-600">Raksti</span>
          <span>/</span>
          <span className="text-gray-600">Saldējumu analīze</span>
        </nav>

        {/* ── Title ── */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
          Veselīgākais saldējums Latvijā?<br />
          <span className="text-gray-600 font-normal text-2xl">
            Pārbaudīts: {total} saldējumi no Rimi un Maxima
          </span>
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Publicēts 2025. gadā · Dati: Rimi Latvija un Maxima (Barbora) · Kategorijas: Porcijas saldējumi, Lielo iepakojumu saldējumi
        </p>

        {/* ── Executive summary ── */}
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
          <h2 className="text-lg font-bold text-amber-900 mb-3">Galvenie secinājumi</h2>
          <ul className="space-y-2 text-sm text-amber-900">
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                Analizēti <strong>{total} saldējumi</strong> no Rimi un Maxima (Barbora) — porcijas un lielie iepakojumi.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <strong>Nutri-Score D vai E</strong> saņem {nsDECount} produkti ({Math.round(nsDECount / total * 100)}%) —
                tikai {nsAbCount} produkts saņem vērtējumu B vai augstāku.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <strong>Visi {nova4Pct}%</strong> ({nova4Count}/{total}) ir NOVA 4 — augsti pārstrādāti produkti.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <strong>Cukurs 100 g</strong> svārstās no <strong>{round1(minSugar)} g</strong> līdz{' '}
                <strong>{round1(maxSugar)} g</strong> — tas ir vairāk nekā 6× atšķirība.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold shrink-0">·</span>
              <span>
                <strong>Piesātinātās taukskābes</strong> svārstās no 0 līdz{' '}
                <strong>{round1(maxSatFat)} g</strong> uz 100 g — vairāk nekā 28× starpība.
              </span>
            </li>
          </ul>
        </section>

        {/* ── Stat overview cards ── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Produkti analīzē" value={String(total)} />
          <StatCard
            label="Vid. cukurs"
            value={`${round1(avgSugar)} g`}
            sub="uz 100 g"
          />
          <StatCard
            label="Vid. piesātinātie tauki"
            value={`${round1(avgSatFat)} g`}
            sub="uz 100 g"
          />
          <StatCard
            label="NOVA 4"
            value={`${nova4Pct}%`}
            sub="augsti pārstrādāti"
          />
        </section>

        {/* ── Nutri-Score distribution ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Nutri-Score sadalījums</h2>
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
                  formatter={(val: number) => [`${val} produkti`, '']}
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
            Neviens no {total} analizētajiem saldējumiem nesaņem Nutri-Score A. Tikai viens produkts
            saņem B. Lielākā daļa ({nsDECount} produkti jeb {Math.round(nsDECount / total * 100)}%)
            atrodas D vai E kategorijā. Tas nozīmē, ka saldējums kopumā ir pārtikas produktu kategorija,
            kurā "veselīgs" ir relatīvs jēdziens — labākie varianti ir tie ar mazāko cukuru un
            piesātinātajām taukskābēm.
          </p>
        </section>

        {/* ── NOVA callout ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">NOVA grupas</h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="bg-red-600 text-white text-xl font-bold rounded-lg px-3 py-2 shrink-0">
                NOVA 4
              </div>
              <div>
                <p className="font-semibold text-red-900 mb-1">
                  Visi {total} saldējumi ir NOVA 4 — augsti pārstrādāti produkti.
                </p>
                <p className="text-sm text-red-800 leading-relaxed">
                  NOVA 4 nozīmē, ka produkts satur industriālas sastāvdaļas, kuras nav pieejamas
                  parastā virtuvē — emulgatori, stabilizatori, aromatizētāji, krāsvielas. Šī
                  klasifikācija neatkarīgi no cukura vai tauku daudzuma norāda uz augstu pārstrādes pakāpi.
                  Saldējums pēc definīcijas ir industriāls produkts, tāpēc NOVA 4 nav pārsteigums —
                  bet to ir svarīgi zināt, izvēloties pārtikas produktus bērniem.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── TOP 10 low sugar ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            TOP 10: Mazākais cukurs uz 100 g
          </h2>
          <ProductTable
            title="Mazākais cukura saturs (g/100 g)"
            products={top10LowSugar}
            getValue={p => p.carbsSugars}
            unit="g"
            description="Saldējumi ar vismazāko cukura daudzumu uz 100 g"
          />
          <p className="text-sm text-gray-500 mt-2">
            Produkti ar mazāko cukuru bieži ir bez papildu saldumiem vai satur mākslīgos saldinātājus.
            Pārbaudi sastāvdaļu sarakstu pirms izvēles.
          </p>
        </section>

        {/* ── TOP 10 low sat fat ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            TOP 10: Mazākās piesātinātās taukskābes uz 100 g
          </h2>
          <ProductTable
            title="Mazākās piesātinātās taukskābes (g/100 g)"
            products={top10LowSatFat}
            getValue={p => p.fatSaturated}
            unit="g"
            description="Saldējumi ar vismazāko piesātināto taukskābju daudzumu"
          />
          <p className="text-sm text-gray-500 mt-2">
            Piesātinātās taukskābes galvenokārt nāk no krējuma un kokosriekstu eļļas. Saldētas sulas
            un sorbets parasti satur ievērojami mazāk piesātināto tauku nekā tradicionālais krēmsaldējums.
          </p>
        </section>

        {/* ── TOP 10 few additives ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            TOP 10: Mazākais aizdomīgo piedevu skaits
          </h2>
          <ProductTable
            title="Mazākais aizdomīgo piedevu skaits"
            products={top10FewAdditives}
            getValue={p => p.additiveCount}
            unit="piedevas"
            description="Saldējumi ar vismazāko Ierobežot + Uzmanīgi + Izvairīties piedevu skaitu"
          />
          <p className="text-sm text-gray-500 mt-2">
            Skaits ietver sastāvdaļas, kas klasificētas kā "Ierobežot", "Uzmanīgi" vai "Izvairīties"
            no ingredientu analīzes datubāzes — tas pats skaitlis, kas redzams produktu kartītēs.
            Produkti bez ingredientu analīzes datiem šajā sarakstā nav iekļauti.
          </p>
        </section>

        {/* ── Products to limit ── */}
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Augstākās vērtības — lietot mēreni
          </h2>
          <p className="text-sm text-gray-600 mb-5">
            Šie produkti nav "sliktākie" — bet tie satur visaugstākās cukura, tauku vai piedevu vērtības.
            Izmanto šo informāciju, lai izdarītu apzinātu izvēli.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Augstākais cukurs</h3>
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b bg-gray-50">
                      <th className="px-3 py-1.5 text-left w-8">#</th>
                      <th className="px-3 py-1.5 text-left">Produkts</th>
                      <th className="px-3 py-1.5 text-right">g/100g</th>
                      <th className="px-3 py-1.5 text-right">NS</th>
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
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Augstākās pies. taukskābes</h3>
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b bg-gray-50">
                      <th className="px-3 py-1.5 text-left w-8">#</th>
                      <th className="px-3 py-1.5 text-left">Produkts</th>
                      <th className="px-3 py-1.5 text-right">g/100g</th>
                      <th className="px-3 py-1.5 text-right">NS</th>
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
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Visvairāk aizdomīgo piedevu</h3>
              <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b bg-gray-50">
                      <th className="px-3 py-1.5 text-left w-8">#</th>
                      <th className="px-3 py-1.5 text-left">Produkts</th>
                      <th className="px-3 py-1.5 text-right">Skaits</th>
                      <th className="px-3 py-1.5 text-right">NS</th>
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
          <h2 className="text-base font-semibold text-gray-700 mb-2">Par datiem</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Analīzē iekļauti <strong>{total} saldējumi</strong> no Rimi un Maxima (Barbora) kategorijām
            "Porcijas saldējumi" un "Lielo iepakojumu saldējumi". Dati iegūti no ABCDE.lv datubāzes, kas
            regulāri atjaunina informāciju no Rimi.lv un Barbora.lv. Uzturvērtības norādītas uz 100 g
            produkta. Nutri-Score un NOVA grupas aprēķinātas pēc Eiropas standarta metodikas. Piedevu
            skaits atspoguļo "Ierobežot", "Uzmanīgi" un "Izvairīties" sastāvdaļu skaitu no ABCDE.lv
            ingredientu analīzes — tas pats skaitlis, kas redzams produktu kartītēs.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Visus saldējumus var{' '}
            <Link href="/lv/category/saldejums-un-ledus-24" className="text-primary hover:underline">
              pārlūkot šeit
            </Link>
            , filtrējot pēc Nutri-Score, cukura un citiem parametriem.
          </p>
        </section>

      </main>
    </>
  );
};

export default IceCreamReport;

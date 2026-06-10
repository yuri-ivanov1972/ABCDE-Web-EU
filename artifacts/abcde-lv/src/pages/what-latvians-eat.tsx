import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';

interface NutriScoreDistribution {
  grade: string;
  count: number;
  percentage: number;
}

interface StatsResponse {
  distribution: NutriScoreDistribution[];
  totalProducts: number;
  latvianProducts: {
    distribution: NutriScoreDistribution[];
    totalProducts: number;
  };
  lastUpdated: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: '#038141',
  B: '#85BB2F', 
  C: '#FECB02',
  D: '#EE8100',
  E: '#E63E11'
};

interface StatsSection {
  distribution: NutriScoreDistribution[];
  totalProducts: number;
}

const createArcPath = (startAngle: number, endAngle: number, radius: number) => {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = 100 + radius * Math.cos(startRad);
  const y1 = 100 + radius * Math.sin(startRad);
  const x2 = 100 + radius * Math.cos(endRad);
  const y2 = 100 + radius * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  
  return `M 100 100 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
};

const StatsBlock = ({ 
  title, 
  description, 
  stats, 
  t,
  showTitle = true
}: { 
  title: string; 
  description: string; 
  stats: StatsSection; 
  t: (key: string) => string;
  showTitle?: boolean;
}) => {
  const { distribution, totalProducts } = stats;
  
  const healthyCount = distribution
    .filter(d => d.grade === 'A' || d.grade === 'B')
    .reduce((sum, d) => sum + d.count, 0);
  const moderateCount = distribution
    .filter(d => d.grade === 'C')
    .reduce((sum, d) => sum + d.count, 0);
  const unhealthyCount = distribution
    .filter(d => d.grade === 'D' || d.grade === 'E')
    .reduce((sum, d) => sum + d.count, 0);

  const healthyPercentage = totalProducts > 0 ? Math.round((healthyCount / totalProducts) * 100) : 0;
  const moderatePercentage = totalProducts > 0 ? Math.round((moderateCount / totalProducts) * 100) : 0;
  const unhealthyPercentage = totalProducts > 0 ? Math.round((unhealthyCount / totalProducts) * 100) : 0;

  let cumulativeAngle = -90;
  const segments = distribution.map(item => {
    const angle = (item.percentage / 100) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return {
      ...item,
      startAngle,
      endAngle: cumulativeAngle,
      angle
    };
  });

  return (
    <section className="mb-12">
      {showTitle && <h2 className="text-2xl font-bold text-center mb-2">{title}</h2>}
      <p className="text-center text-muted-foreground mb-6">{description}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{healthyPercentage}%</div>
          <div className="text-sm text-green-600">{t('stats:healthyProducts')}</div>
          <div className="text-xs text-green-500 mt-1">{healthyCount.toLocaleString()} {t('stats:count').toLowerCase()}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-yellow-700">{moderatePercentage}%</div>
          <div className="text-sm text-yellow-600">{t('stats:moderateProducts')}</div>
          <div className="text-xs text-yellow-500 mt-1">{moderateCount.toLocaleString()} {t('stats:count').toLowerCase()}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-red-700">{unhealthyPercentage}%</div>
          <div className="text-sm text-red-600">{t('stats:unhealthyProducts')}</div>
          <div className="text-xs text-red-500 mt-1">{unhealthyCount.toLocaleString()} {t('stats:count').toLowerCase()}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h3 className="text-lg font-semibold text-center mb-6">{t('stats:chartTitle')}</h3>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
          <div className="relative">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {segments.map((segment) => (
                <path
                  key={segment.grade}
                  d={createArcPath(segment.startAngle, segment.endAngle, 90)}
                  fill={GRADE_COLORS[segment.grade]}
                  stroke="white"
                  strokeWidth="2"
                />
              ))}
              <circle cx="100" cy="100" r="40" fill="white" />
              <text x="100" y="95" textAnchor="middle" className="text-sm font-medium fill-gray-600">
                {t('stats:totalProducts')}
              </text>
              <text x="100" y="115" textAnchor="middle" className="text-lg font-bold fill-gray-800">
                {totalProducts.toLocaleString()}
              </text>
            </svg>
          </div>

          <div className="space-y-3">
            {distribution.map(item => (
              <div key={item.grade} className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: GRADE_COLORS[item.grade] }}
                >
                  {item.grade}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.percentage}%</span>
                    <span className="text-muted-foreground text-sm">
                      ({item.count.toLocaleString()})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">{t('stats:grade')}</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">{t('stats:count')}</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">{t('stats:percentage')}</th>
            </tr>
          </thead>
          <tbody>
            {distribution.map(item => (
              <tr key={item.grade} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-6 h-6 rounded flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: GRADE_COLORS[item.grade] }}
                    >
                      {item.grade}
                    </div>
                    <span>Nutri-Score {item.grade}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium">{item.count.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{item.percentage}%</td>
              </tr>
            ))}
            <tr className="border-t bg-gray-50 font-medium">
              <td className="px-4 py-3">{t('stats:totalProducts')}</td>
              <td className="px-4 py-3 text-right">{totalProducts.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

const WhatLatviansEat = () => {
  const { t, i18n } = useTranslation(['stats', 'common']);
  const currentLang = i18n.language?.split('-')[0] || 'lv';
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  const { data, isLoading, error } = useQuery<StatsResponse>({
    queryKey: ['/api/stats/nutri-score-distribution']
  });

  const baseUrl = 'https://abcde.lv';
  const lvPath = '/ko-ed-latvija';
  const enPath = '/what-latvians-eat';
  const currentPath = currentLang === 'en' ? enPath : lvPath;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500">
          {t('common:loading')}
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t('stats:title')} | ABCDE.lv</title>
        <meta name="description" content={t('stats:description')} />
        <link rel="canonical" href={`${baseUrl}/lv${lvPath}`} />
        <link rel="alternate" hrefLang="lv" href={`${baseUrl}/lv${lvPath}`} />
        <link rel="alternate" hrefLang="en" href={`${baseUrl}/en${enPath}`} />
        <link rel="alternate" hrefLang="x-default" href={`${baseUrl}/lv${lvPath}`} />
      </Helmet>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-8">{t('stats:title')}</h1>

        <StatsBlock
          title={t('stats:title')}
          description={t('stats:description')}
          stats={{ distribution: data.distribution, totalProducts: data.totalProducts }}
          t={t}
          showTitle={false}
        />

        <StatsBlock
          title={t('stats:latvianTitle')}
          description={t('stats:latvianDescription')}
          stats={data.latvianProducts}
          t={t}
        />

        <p className="text-center text-sm text-muted-foreground">
          {t('stats:lastUpdated')}: {new Date(data.lastUpdated).toLocaleDateString(i18n.language === 'lv' ? 'lv-LV' : 'en-US')}
        </p>
      </main>
    </>
  );
};

export default WhatLatviansEat;

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import LangLink from '@/components/routing/LangLink';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function AboutNutriScore() {
  const { t } = useTranslation('aboutNutriScore');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>{t('meta.title')}</title>
        <meta name="description" content={t('meta.description')} />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <LangLink href="/">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t('backToHome')}
                </Button>
              </LangLink>
            </div>
            <div className="mt-4">
              <h1 className="text-2xl md:text-3xl font-bold">{t('title')}</h1>
              <p className="text-muted-foreground mt-2 max-w-3xl">
                {t('subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl">
            <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex gap-1">
                  {['A', 'B', 'C', 'D', 'E'].map((letter, i) => (
                    <div
                      key={letter}
                      className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm ${
                        i === 0 ? 'bg-[#038141]' :
                        i === 1 ? 'bg-[#85bb2f]' :
                        i === 2 ? 'bg-[#fecb02]' :
                        i === 3 ? 'bg-[#ee8100]' :
                        'bg-[#e63e11]'
                      }`}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-gray-700">{t('intro')}</p>
            </div>

            <Accordion type="multiple" className="space-y-4" defaultValue={["what-is", "how-calculated"]}>
              <AccordionItem value="what-is" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {t('sections.whatIs.title')}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-4 pb-4">
                  <p>{t('sections.whatIs.p1')}</p>
                  <p>{t('sections.whatIs.p2')}</p>
                  <p>{t('sections.whatIs.p3')}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="why-important" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {t('sections.whyImportant.title')}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-4 pb-4">
                  <p>{t('sections.whyImportant.p1')}</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>{t('sections.whyImportant.bullet1')}</li>
                    <li>{t('sections.whyImportant.bullet2')}</li>
                    <li>{t('sections.whyImportant.bullet3')}</li>
                    <li>{t('sections.whyImportant.bullet4')}</li>
                  </ul>
                  <p>{t('sections.whyImportant.p2')}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="how-calculated" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {t('sections.howCalculated.title')}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-4 pb-4">
                  <p>{t('sections.howCalculated.p1')}</p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-semibold text-red-800 mb-2">{t('sections.howCalculated.negative.title')}</h4>
                    <ul className="list-disc pl-6 space-y-1 text-red-700">
                      <li>{t('sections.howCalculated.negative.item1')}</li>
                      <li>{t('sections.howCalculated.negative.item2')}</li>
                      <li>{t('sections.howCalculated.negative.item3')}</li>
                      <li>{t('sections.howCalculated.negative.item4')}</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2">{t('sections.howCalculated.positive.title')}</h4>
                    <ul className="list-disc pl-6 space-y-1 text-green-700">
                      <li>{t('sections.howCalculated.positive.item1')}</li>
                      <li>{t('sections.howCalculated.positive.item2')}</li>
                      <li>{t('sections.howCalculated.positive.item3')}</li>
                    </ul>
                  </div>
                  <p>{t('sections.howCalculated.p2')}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="how-to-use" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {t('sections.howToUse.title')}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-4 pb-4">
                  <p>{t('sections.howToUse.p1')}</p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</span>
                      <p>{t('sections.howToUse.step1')}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</span>
                      <p>{t('sections.howToUse.step2')}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</span>
                      <p>{t('sections.howToUse.step3')}</p>
                    </div>
                  </div>
                  <p>{t('sections.howToUse.p2')}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="limitations" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {t('sections.limitations.title')}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-4 pb-4">
                  <p>{t('sections.limitations.p1')}</p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>{t('sections.limitations.bullet1')}</li>
                    <li>{t('sections.limitations.bullet2')}</li>
                    <li>{t('sections.limitations.bullet3')}</li>
                    <li>{t('sections.limitations.bullet4')}</li>
                    <li>{t('sections.limitations.bullet5')}</li>
                  </ul>
                  <p>{t('sections.limitations.p2')}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="myths" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {t('sections.myths.title')}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-6 pb-4">
                  <div className="space-y-4">
                    <div className="border-l-4 border-amber-400 pl-4">
                      <p className="font-semibold text-amber-800">{t('sections.myths.myth1.claim')}</p>
                      <p className="mt-2">{t('sections.myths.myth1.truth')}</p>
                    </div>
                    <div className="border-l-4 border-amber-400 pl-4">
                      <p className="font-semibold text-amber-800">{t('sections.myths.myth2.claim')}</p>
                      <p className="mt-2">{t('sections.myths.myth2.truth')}</p>
                    </div>
                    <div className="border-l-4 border-amber-400 pl-4">
                      <p className="font-semibold text-amber-800">{t('sections.myths.myth3.claim')}</p>
                      <p className="mt-2">{t('sections.myths.myth3.truth')}</p>
                    </div>
                    <div className="border-l-4 border-amber-400 pl-4">
                      <p className="font-semibold text-amber-800">{t('sections.myths.myth4.claim')}</p>
                      <p className="mt-2">{t('sections.myths.myth4.truth')}</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="countries" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {t('sections.countries.title')}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-4 pb-4">
                  <p>{t('sections.countries.p1')}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {['france', 'belgium', 'germany', 'spain', 'netherlands', 'luxembourg', 'switzerland'].map((country) => (
                      <div key={country} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <span className="text-green-600">✓</span>
                        <span>{t(`sections.countries.${country}`)}</span>
                      </div>
                    ))}
                  </div>
                  <p>{t('sections.countries.p2')}</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="scientific" className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                  {t('sections.scientific.title')}
                </AccordionTrigger>
                <AccordionContent className="text-gray-700 space-y-4 pb-4">
                  <p>{t('sections.scientific.p1')}</p>
                  <p>{t('sections.scientific.p2')}</p>
                  <p>{t('sections.scientific.p3')}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">{t('source.title')}</h3>
              <p className="text-blue-700 text-sm mb-3">{t('source.description')}</p>
              <a 
                href="https://nutriscore.blog" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                nutriscore.blog →
              </a>
              <br />
              <a
                href="https://lv.wikipedia.org/wiki/Nutri-Score"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                {t('source.wikipediaLink')} →
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

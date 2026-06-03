import { notFound } from 'next/navigation';
import { BrandsSection, FeatureGrid, StepsSection } from '@/components/feature-grid';
import { Hero } from '@/components/hero';
import { isLocale, type Locale } from '@/lib/i18n';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  return (
    <>
      <Hero locale={locale} />
      <FeatureGrid locale={locale} />
      <StepsSection locale={locale} />
      <BrandsSection locale={locale} />
    </>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/json-ld';
import { BrandsSection, FeatureGrid, StepsSection } from '@/components/feature-grid';
import { Hero } from '@/components/hero';
import { isLocale, type Locale } from '@/lib/i18n';
import {
  buildPageMetadata,
  buildSoftwareApplicationJsonLd,
  buildWebSiteJsonLd,
} from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return buildPageMetadata(raw, 'home');
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  return (
    <>
      <JsonLd data={[buildWebSiteJsonLd(locale), buildSoftwareApplicationJsonLd(locale)]} />
      <Hero locale={locale} />
      <FeatureGrid locale={locale} />
      <StepsSection locale={locale} />
      <BrandsSection locale={locale} />
    </>
  );
}

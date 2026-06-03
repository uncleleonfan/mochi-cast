import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { getContent, isLocale, locales, type Locale } from '@/lib/i18n';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  const c = getContent(raw);
  return {
    title: c.meta.title,
    description: c.meta.description,
    metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://mochi-cast.vercel.app'),
    openGraph: {
      title: c.meta.title,
      description: c.meta.description,
      images: ['/icons/icon128.png'],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();

  const locale = raw as Locale;

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'}>
      <head>
        <link rel="preload" href="/icons/icon128.png" as="image" type="image/png" />
        <link rel="preload" href="/icons/icon48.png" as="image" type="image/png" />
      </head>
      <body className="min-h-screen antialiased">
        <Header locale={locale} />
        <main>{children}</main>
        <Footer locale={locale} />
      </body>
    </html>
  );
}

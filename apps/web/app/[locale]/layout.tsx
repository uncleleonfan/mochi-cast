import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/footer';
import { GoogleAnalytics } from '@/components/google-analytics';
import { Header } from '@/components/header';
import { getContent, isLocale, locales, type Locale } from '@/lib/i18n';
import { getSiteUrl } from '@/lib/site';
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
    metadataBase: new URL(getSiteUrl()),
    applicationName: c.seo.siteName,
    authors: [{ name: c.seo.siteName, url: getSiteUrl() }],
    creator: c.seo.siteName,
    icons: {
      icon: [{ url: '/icons/icon48.png', sizes: '48x48', type: 'image/png' }],
      apple: [{ url: '/icons/icon128.png', sizes: '128x128', type: 'image/png' }],
    },
    manifest: '/manifest.webmanifest',
    verification: {
      other: {
        'baidu-site-verification': 'codeva-FujtwYt0up',
      },
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
        <GoogleAnalytics />
      </body>
    </html>
  );
}

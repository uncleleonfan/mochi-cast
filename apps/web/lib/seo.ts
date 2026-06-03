import type { Locale } from '@/lib/i18n';
import { defaultLocale, getContent, localePath, locales } from '@/lib/i18n';
import { getSiteUrl } from '@/lib/site';
import type { Metadata } from 'next';

export type SeoPage = 'home' | 'download' | 'guide' | 'compatibility' | 'privacy';

const PAGE_PATH: Record<SeoPage, string> = {
  home: '',
  download: 'download',
  guide: 'guide',
  compatibility: 'compatibility',
  privacy: 'privacy',
};

export function buildPageMetadata(locale: Locale, page: SeoPage): Metadata {
  const c = getContent(locale);
  const { title, description } = c.seo.pages[page];
  const siteUrl = getSiteUrl();
  const path = PAGE_PATH[page];
  const canonical = `${siteUrl}${localePath(locale, path)}`;

  const languages: Record<string, string> = {
    'x-default': `${siteUrl}${localePath(defaultLocale, path)}`,
  };
  for (const loc of locales) {
    languages[loc] = `${siteUrl}${localePath(loc, path)}`;
  }

  return {
    title,
    description,
    keywords: c.seo.keywords,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: c.seo.siteName,
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      alternateLocale: locale === 'zh' ? ['en_US'] : ['zh_CN'],
      type: 'website',
      images: [
        {
          url: '/icons/icon128.png',
          width: 128,
          height: 128,
          alt: c.seo.siteName,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: ['/icons/icon128.png'],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

export function buildSoftwareApplicationJsonLd(locale: Locale) {
  const c = getContent(locale);
  const siteUrl = getSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: c.hero.title,
    alternateName: c.hero.subtitle,
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'Chrome, Edge',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description: c.hero.description,
    url: `${siteUrl}${localePath(locale)}`,
    downloadUrl: `${siteUrl}${localePath(locale, 'download')}`,
    softwareHelp: `${siteUrl}${localePath(locale, 'guide')}`,
    author: {
      '@type': 'Organization',
      name: c.seo.siteName,
      url: siteUrl,
    },
  };
}

export function buildWebSiteJsonLd(locale: Locale) {
  const c = getContent(locale);
  const siteUrl = getSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: c.seo.siteName,
    url: siteUrl,
    inLanguage: locale === 'zh' ? 'zh-CN' : 'en',
    description: c.meta.description,
  };
}

export function buildFaqJsonLd(locale: Locale) {
  const c = getContent(locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: c.guide.faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

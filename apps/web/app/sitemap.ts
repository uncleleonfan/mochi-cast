import type { MetadataRoute } from 'next';
import { defaultLocale, locales, localePath } from '@/lib/i18n';
import { getSiteUrl } from '@/lib/site';

const pages = ['', 'download', 'guide', 'compatibility', 'privacy'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();

  return locales.flatMap((locale) =>
    pages.map((page) => ({
      url: `${base}${localePath(locale, page)}`,
      lastModified: new Date(),
      changeFrequency: page === '' ? ('weekly' as const) : ('monthly' as const),
      priority: page === '' ? 1 : page === 'download' ? 0.9 : 0.7,
      alternates: {
        languages: {
          ...Object.fromEntries(locales.map((loc) => [loc, `${base}${localePath(loc, page)}`])),
          'x-default': `${base}${localePath(defaultLocale, page)}`,
        },
      },
    })),
  );
}

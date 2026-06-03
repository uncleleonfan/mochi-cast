import type { MetadataRoute } from 'next';
import { locales } from '@/lib/i18n';

const pages = ['', 'download', 'guide', 'compatibility', 'privacy'];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://mochi-cast.vercel.app';

  return locales.flatMap((locale) =>
    pages.map((page) => ({
      url: `${base}/${locale}${page ? `/${page}` : ''}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: page === '' ? 1 : 0.8,
    })),
  );
}

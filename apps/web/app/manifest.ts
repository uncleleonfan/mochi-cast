import type { MetadataRoute } from 'next';
import { getContent } from '@/lib/i18n';
import { getSiteUrl, SITE_LOGO_LG } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  const c = getContent('zh');

  return {
    name: c.seo.siteName,
    short_name: c.hero.title,
    description: c.meta.description,
    start_url: '/zh',
    display: 'browser',
    background_color: '#faf8f5',
    theme_color: '#e87c3c',
    icons: [{ src: SITE_LOGO_LG, sizes: '512x512', type: 'image/png', purpose: 'any' }],
  };
}

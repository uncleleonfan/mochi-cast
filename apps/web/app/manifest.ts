import type { MetadataRoute } from 'next';
import { getContent } from '@/lib/i18n';
import { getSiteUrl } from '@/lib/site';

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
    icons: [
      { src: '/icons/icon48.png', sizes: '48x48', type: 'image/png' },
      { src: '/icons/icon128.png', sizes: '128x128', type: 'image/png' },
    ],
  };
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { locales } from '@/lib/i18n';

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  function switchPath(target: Locale) {
    const segments = pathname.split('/');
    segments[1] = target;
    return segments.join('/') || `/${target}`;
  }

  return (
    <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-0.5 text-xs">
      {locales.map((loc) => (
        <Link
          key={loc}
          href={switchPath(loc)}
          className={`rounded-md px-2 py-1 uppercase ${
            loc === locale ? 'bg-brand text-white' : 'text-[var(--color-muted)] hover:text-brand'
          }`}
        >
          {loc}
        </Link>
      ))}
    </div>
  );
}

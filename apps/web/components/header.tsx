'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { getContent, localePath } from '@/lib/i18n';
import { GITHUB_REPO } from '@/lib/site';
import { LocaleSwitcher } from './locale-switcher';

const navItems = [
  { key: 'home' as const, path: '' },
  { key: 'download' as const, path: 'download' },
  { key: 'guide' as const, path: 'guide' },
  { key: 'compatibility' as const, path: 'compatibility' },
  { key: 'privacy' as const, path: 'privacy' },
];

export function Header({ locale }: { locale: Locale }) {
  const c = getContent(locale);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href={localePath(locale)} className="flex items-center gap-2 font-semibold">
          <Image src="/icons/icon48.png" alt="" width={32} height={32} className="rounded-lg" />
          <span>{c.hero.title}</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={localePath(locale, item.path)}
              className={`text-sm transition-colors hover:text-brand ${
                pathname === localePath(locale, item.path) ? 'text-brand font-medium' : 'text-[var(--color-muted)]'
              }`}
            >
              {c.nav[item.key]}
            </Link>
          ))}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-muted)] hover:text-brand"
          >
            {c.nav.github}
          </a>
          <LocaleSwitcher locale={locale} />
        </nav>

        <button
          type="button"
          className="md:hidden rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <nav className="border-t border-[var(--color-border)] px-4 py-3 md:hidden flex flex-col gap-3">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={localePath(locale, item.path)}
              onClick={() => setOpen(false)}
              className="text-sm"
            >
              {c.nav[item.key]}
            </Link>
          ))}
          <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="text-sm">
            {c.nav.github}
          </a>
          <LocaleSwitcher locale={locale} />
        </nav>
      )}
    </header>
  );
}

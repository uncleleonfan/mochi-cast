import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import { getContent, localePath } from '@/lib/i18n';
import { GITHUB_REPO, RELEASE_URL, SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/site';

export function Footer({ locale }: { locale: Locale }) {
  const c = getContent(locale);

  return (
    <footer className="mt-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold">{c.hero.title}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{c.footer.tagline}</p>
          <p className="mt-2 text-xs text-[var(--color-muted)]">{c.footer.license}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href={localePath(locale, 'download')} className="hover:text-brand">
            {c.nav.download}
          </Link>
          <Link href={localePath(locale, 'privacy')} className="hover:text-brand">
            {c.nav.privacy}
          </Link>
          <a href={SUPPORT_MAILTO} className="hover:text-brand">
            {SUPPORT_EMAIL}
          </a>
          <a href={RELEASE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
            Release
          </a>
          <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="hover:text-brand">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

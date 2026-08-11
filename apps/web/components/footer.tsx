import type { Locale } from '@/lib/i18n';
import { getContent, localePath } from '@/lib/i18n';
import { GITHUB_REPO, RELEASE_URL, SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/site';
import { TrackedLink } from './tracked-link';

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
          <TrackedLink
            variant="link"
            href={localePath(locale, 'download')}
            eventAction="download"
            eventCategory="footer"
            className="hover:text-brand"
          >
            {c.nav.download}
          </TrackedLink>
          <TrackedLink
            variant="link"
            href={localePath(locale, 'privacy')}
            eventAction="privacy"
            eventCategory="footer"
            className="hover:text-brand"
          >
            {c.nav.privacy}
          </TrackedLink>
          <TrackedLink
            variant="a"
            href={SUPPORT_MAILTO}
            eventAction="email"
            eventCategory="footer"
            className="hover:text-brand"
          >
            {SUPPORT_EMAIL}
          </TrackedLink>
          <TrackedLink
            variant="a"
            href={RELEASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            eventAction="release"
            eventCategory="footer"
            className="hover:text-brand"
          >
            Release
          </TrackedLink>
          <TrackedLink
            variant="a"
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            eventAction="github"
            eventCategory="footer"
            className="hover:text-brand"
          >
            GitHub
          </TrackedLink>
        </div>
      </div>
    </footer>
  );
}

import type { Locale } from '@/lib/i18n';
import { getContent, localePath } from '@/lib/i18n';
import { chromeWebStoreUrl, DOWNLOAD_ZIP, GITHUB_REPO } from '@/lib/site';
import { SiteLogo } from './site-logo';
import { TrackedLink } from './tracked-link';

export function Hero({ locale }: { locale: Locale }) {
  const c = getContent(locale);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <div className="mb-6 flex items-center gap-4">
          <SiteLogo size={80} priority />
          <div>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{c.hero.title}</h1>
            <p className="text-lg text-[var(--color-muted)]">{c.hero.subtitle}</p>
          </div>
        </div>
        <p className="max-w-2xl text-lg leading-relaxed text-[var(--color-muted)]">{c.hero.description}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3 justify-center md:justify-start">
          <TrackedLink
            variant="a"
            href={DOWNLOAD_ZIP}
            eventAction="download_zip"
            eventCategory="hero"
            className="rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-md transition hover:bg-brand-hover"
          >
            {c.hero.downloadZip}
          </TrackedLink>
          <TrackedLink
            variant="link"
            href={localePath(locale, 'download')}
            eventAction="install_guide"
            eventCategory="hero"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-semibold transition hover:border-brand"
          >
            {c.hero.installGuide}
          </TrackedLink>
          <TrackedLink
            variant="a"
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            eventAction="github"
            eventCategory="hero"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-semibold transition hover:border-brand"
          >
            {c.hero.github}
          </TrackedLink>
        </div>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          {c.hero.chromeStoreBefore}{' '}
          <TrackedLink
            variant="a"
            href={chromeWebStoreUrl(locale)}
            target="_blank"
            rel="noopener noreferrer"
            eventAction="chrome_store"
            eventCategory="hero"
            className="text-brand hover:underline"
          >
            {c.hero.chromeStore}
          </TrackedLink>{' '}
          {c.hero.chromeStoreAfter}
        </p>
      </div>
    </section>
  );
}

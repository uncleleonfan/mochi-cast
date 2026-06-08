import type { Locale } from '@/lib/i18n';
import { getContent } from '@/lib/i18n';
import { chromeWebStoreUrl, DOWNLOAD_ZIP, RELEASE_URL } from '@/lib/site';

export function DownloadCard({ locale }: { locale: Locale }) {
  const d = getContent(locale).download;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold">{d.title}</h1>
        <p className="text-[var(--color-muted)]">{d.description}</p>
      </div>

      <section className="rounded-2xl border-2 border-brand/25 bg-brand/[0.04] p-8 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold">{d.zipSectionTitle}</h2>
          <span className="rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-white">
            {d.zipSectionBadge}
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          <a
            href={DOWNLOAD_ZIP}
            className="rounded-xl bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-hover"
          >
            {d.zipButton}
          </a>
          <a
            href={RELEASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-semibold transition hover:border-brand"
          >
            {d.releaseLink}
          </a>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">{d.zipNote}</p>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-muted)]">{d.chromeSectionTitle}</h2>
        <p className="mb-4 text-sm leading-relaxed text-[var(--color-muted)]">{d.chromeSectionDescription}</p>
        <a
          href={chromeWebStoreUrl(locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-semibold transition hover:border-brand"
        >
          {d.chromeStoreButton}
        </a>
      </section>
    </div>
  );
}

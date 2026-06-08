import type { Locale } from '@/lib/i18n';
import { getContent } from '@/lib/i18n';
import { chromeWebStoreUrl, DOWNLOAD_ZIP, RELEASE_URL } from '@/lib/site';

export function DownloadCard({ locale }: { locale: Locale }) {
  const d = getContent(locale).download;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-sm">
      <h2 className="mb-2 text-2xl font-bold">{d.title}</h2>
      <p className="mb-6 text-[var(--color-muted)]">{d.description}</p>
      <div className="flex flex-wrap gap-4">
        <a
          href={chromeWebStoreUrl(locale)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-hover"
        >
          {d.chromeStoreButton}
        </a>
        <a
          href={DOWNLOAD_ZIP}
          className="rounded-xl border border-[var(--color-border)] px-6 py-3 font-semibold transition hover:border-brand"
        >
          {d.zipButton}
        </a>
        <a
          href={RELEASE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-[var(--color-border)] px-6 py-3 font-semibold transition hover:border-brand"
        >
          {d.releaseLink}
        </a>
      </div>
      <p className="mt-4 text-sm text-[var(--color-muted)]">{d.storeNote}</p>
    </div>
  );
}

import { notFound } from 'next/navigation';
import { DownloadCard } from '@/components/download-card';
import { getContent, isLocale, type Locale } from '@/lib/i18n';

export default async function DownloadPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const d = getContent(locale).download;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <DownloadCard locale={locale} />
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">{d.requirements}</h2>
        <ul className="list-disc space-y-2 pl-5 text-[var(--color-muted)]">
          {d.reqItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">{d.stepsTitle}</h2>
        <ol className="list-decimal space-y-3 pl-5 text-[var(--color-muted)]">
          {d.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

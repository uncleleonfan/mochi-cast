import { notFound } from 'next/navigation';
import { getContent, isLocale, type Locale } from '@/lib/i18n';

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const g = getContent(locale).guide;

  return (
    <div className="prose-page mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-bold">{g.title}</h1>

      <h2>{g.quickStartTitle}</h2>
      <ol className="list-decimal space-y-2 pl-5">
        {g.quickStart.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <h2>{g.tvSetupTitle}</h2>
      {g.tvSetups.map((tv) => (
        <div key={tv.brand} className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="mb-3 font-semibold">{tv.brand}</h3>
          <ul>
            {tv.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ))}

      <h2>{g.formatsTitle}</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="py-2 pr-4">Format</th>
              <th className="py-2">Support</th>
            </tr>
          </thead>
          <tbody>
            {g.formats.map((row) => (
              <tr key={row.type} className="border-b border-[var(--color-border)]">
                <td className="py-2 pr-4">{row.type}</td>
                <td className={`py-2 ${row.ok ? 'text-brand font-medium' : 'text-[var(--color-muted)]'}`}>
                  {row.support}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{g.faqTitle}</h2>
      {g.faq.map((item) => (
        <div key={item.q} className="mb-4">
          <p className="font-medium">{item.q}</p>
          <p>{item.a}</p>
        </div>
      ))}
    </div>
  );
}

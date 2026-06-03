import { notFound } from 'next/navigation';
import { getContent, isLocale, type Locale } from '@/lib/i18n';
import { ISSUES_URL } from '@/lib/site';

function CompatTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] text-left">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[var(--color-border)]">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-[var(--color-muted)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function CompatibilityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const c = getContent(locale).compatibility;

  return (
    <div className="prose-page mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-4 text-3xl font-bold">{c.title}</h1>
      <p>{c.description}</p>

      <h2>{c.legendTitle}</h2>
      <ul className="flex flex-wrap gap-4 list-none pl-0">
        {c.legend.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      <h2>{c.domesticTitle}</h2>
      <CompatTable headers={c.domesticHeaders} rows={c.domesticRows} />

      <h2>{c.overseasTitle}</h2>
      <CompatTable headers={c.overseasHeaders} rows={c.overseasRows} />

      <p className="mt-8">
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-brand font-medium hover:underline">
          {c.contribute} →
        </a>
      </p>

      <h2>{c.limitsTitle}</h2>
      <ul>
        {c.limits.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

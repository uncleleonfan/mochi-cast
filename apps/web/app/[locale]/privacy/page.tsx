import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent, isLocale, type Locale } from '@/lib/i18n';
import { ISSUES_URL, SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/site';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  if (!isLocale(raw)) return {};
  return buildPageMetadata(raw, 'privacy');
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const p = getContent(locale).privacy;

  return (
    <div className="prose-page mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold">{p.title}</h1>
      <p className="text-sm text-[var(--color-muted)]">{p.updated}</p>

      <h2>{p.summaryTitle}</h2>
      <p>{p.summary}</p>

      <h2>{p.accessTitle}</h2>
      <ul className="list-none pl-0 space-y-3">
        {p.access.map((item) => (
          <li key={item.label}>
            <strong>{item.label}:</strong> {item.text}
          </li>
        ))}
      </ul>

      <h2>{p.notCollectTitle}</h2>
      <ul>
        {p.notCollect.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2>{p.websiteTitle}</h2>
      <p>{p.websiteAnalytics}</p>

      <h2>{p.permissionsTitle}</h2>
      <ul>
        {p.permissions.map((item) => (
          <li key={item}>
            <code className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-sm">{item.split(' —')[0]}</code>
            {item.includes(' —') ? ` —${item.split(' —').slice(1).join(' —')}` : ''}
          </li>
        ))}
      </ul>

      <h2>{p.contactTitle}</h2>
      <p>{p.contact}</p>
      <p>
        <strong>{p.supportEmailLabel}:</strong>{' '}
        <a href={SUPPORT_MAILTO} className="text-brand hover:underline">
          {SUPPORT_EMAIL}
        </a>
      </p>
      <p>
        {p.contactIssuesBefore}{' '}
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
          GitHub Issues
        </a>
        {p.contactIssuesAfter}
      </p>
    </div>
  );
}

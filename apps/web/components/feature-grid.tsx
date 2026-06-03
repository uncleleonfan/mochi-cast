import type { Locale } from '@/lib/i18n';
import { getContent } from '@/lib/i18n';

export function FeatureGrid({ locale }: { locale: Locale }) {
  const { features } = getContent(locale);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="mb-8 text-center text-2xl font-bold md:text-left">{features.title}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {features.items.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
          >
            <h3 className="mb-2 font-semibold">{item.title}</h3>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function StepsSection({ locale }: { locale: Locale }) {
  const { steps } = getContent(locale);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="mb-8 text-center text-2xl font-bold">{steps.title}</h2>
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.items.map((item, i) => (
          <li
            key={item.title}
            className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
          >
            <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
              {i + 1}
            </span>
            <h3 className="mb-2 font-semibold">{item.title}</h3>
            <p className="text-sm text-[var(--color-muted)]">{item.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function BrandsSection({ locale }: { locale: Locale }) {
  const { brands } = getContent(locale);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 text-center">
      <h2 className="mb-6 text-xl font-semibold text-[var(--color-muted)]">{brands.title}</h2>
      <div className="flex flex-wrap justify-center gap-3">
        {brands.items.map((brand) => (
          <span
            key={brand}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium"
          >
            {brand}
          </span>
        ))}
      </div>
    </section>
  );
}

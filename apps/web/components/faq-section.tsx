type FaqItem = { q: string; a: string };

export function FaqSection({ title, items }: { title: string; items: FaqItem[] }) {
  return (
    <section className="mt-10">
      <h2 className="mb-5 text-xl font-semibold">{title}</h2>
      <div className="space-y-3">
        {items.map((item, index) => (
          <details
            key={item.q}
            className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition-shadow hover:shadow-md open:shadow-md"
            {...(index === 0 ? { open: true } : {})}
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/12 text-xs font-bold text-brand"
                >
                  {index + 1}
                </span>
                <span className="font-medium leading-snug">{item.q}</span>
              </span>
              <ChevronIcon className="mt-1 h-5 w-5 shrink-0 text-[var(--color-muted)] transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)]/40 px-5 py-4 pl-[3.25rem] text-sm leading-relaxed text-[var(--color-muted)]">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

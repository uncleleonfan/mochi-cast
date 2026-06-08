import { siteLogoSrc } from '@/lib/site';

type SiteLogoProps = {
  size: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

/** Sized transparent mascot PNGs — avoids decoding an 800KB image for a 32px header icon. */
export function SiteLogo({ size, className, priority, alt = '' }: SiteLogoProps) {
  const src = siteLogoSrc(size);
  const eager = priority || size <= 40;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-hidden={alt === '' ? true : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={className ?? 'h-full w-full object-contain'}
        decoding={eager ? 'sync' : 'async'}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : size <= 40 ? 'high' : 'auto'}
        draggable={false}
      />
    </span>
  );
}

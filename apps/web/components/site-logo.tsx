import { SITE_LOGO } from '@/lib/site';

type SiteLogoProps = {
  size: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

/** Transparent brand mascot from /public/logo.png */
export function SiteLogo({ size, className, priority, alt = '' }: SiteLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SITE_LOGO}
      alt={alt}
      width={size}
      height={size}
      className={className}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      draggable={false}
    />
  );
}

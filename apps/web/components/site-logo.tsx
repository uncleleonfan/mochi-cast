type SiteLogoProps = {
  size: number;
  className?: string;
  priority?: boolean;
};

/** Static PNG from /public — native img avoids next/image re-fetch flash on tab focus / client navigation. */
export function SiteLogo({ size, className, priority }: SiteLogoProps) {
  const src = size >= 64 ? '/icons/icon128.png' : '/icons/icon48.png';

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      draggable={false}
    />
  );
}

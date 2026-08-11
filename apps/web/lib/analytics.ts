export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? '';

export function isAnalyticsEnabled(): boolean {
  return /^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID);
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackPageView(path: string, measurementId: string) {
  window.gtag?.('config', measurementId, { page_path: path });
}

export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number,
) {
  if (!isAnalyticsEnabled()) return;
  window.gtag?.('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}

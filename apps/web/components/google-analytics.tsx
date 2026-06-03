import Script from 'next/script';
import { AnalyticsPageView } from '@/components/analytics-page-view';
import { GA_MEASUREMENT_ID, isAnalyticsEnabled } from '@/lib/analytics';

export function GoogleAnalytics() {
  if (!isAnalyticsEnabled()) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
      <AnalyticsPageView measurementId={GA_MEASUREMENT_ID} />
    </>
  );
}

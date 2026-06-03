'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackPageView } from '@/lib/analytics';

export function AnalyticsPageView({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname, measurementId);
  }, [pathname, measurementId]);

  return null;
}

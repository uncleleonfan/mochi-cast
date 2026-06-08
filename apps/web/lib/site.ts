export const GITHUB_REPO = 'https://github.com/uncleleonfan/mochi-cast';
export const RELEASE_URL = `${GITHUB_REPO}/releases/tag/v1.0.1`;
export const DOWNLOAD_ZIP = `${GITHUB_REPO}/releases/download/v1.0.1/mochi-cast-1.0.1-chrome.zip`;
export const ISSUES_URL = `${GITHUB_REPO}/issues`;
export const SUPPORT_EMAIL = 'support@mashutouping.com';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const SITE_LOGO_SM = '/logo-64.png';
export const SITE_LOGO_MD = '/logo-160.png';
export const SITE_LOGO_LG = '/logo-512.png';

/** @deprecated Use sized logos via siteLogoSrc() */
export const SITE_LOGO = SITE_LOGO_LG;

export function siteLogoSrc(displaySize: number): string {
  if (displaySize <= 40) return SITE_LOGO_SM;
  if (displaySize <= 96) return SITE_LOGO_MD;
  return SITE_LOGO_LG;
}
export const CHROME_WEB_STORE_ID = 'eopgdjlalbnodjmamojajnjihiibalbo';

export function chromeWebStoreUrl(locale: 'zh' | 'en' = 'zh'): string {
  return `https://chromewebstore.google.com/detail/${CHROME_WEB_STORE_ID}?hl=${locale}`;
}

/** Canonical production URL. Override with NEXT_PUBLIC_SITE_URL on Vercel. */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://mashutouping.com';
}

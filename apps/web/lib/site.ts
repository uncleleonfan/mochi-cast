export const GITHUB_REPO = 'https://github.com/uncleleonfan/mochi-cast';
export const RELEASE_URL = `${GITHUB_REPO}/releases/tag/v1.0.0`;
export const DOWNLOAD_ZIP = `${GITHUB_REPO}/releases/download/v1.0.0/mochi-cast-1.0.0-chrome.zip`;
export const ISSUES_URL = `${GITHUB_REPO}/issues`;
export const SUPPORT_EMAIL = 'support@mashutouping.com';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

/** Canonical production URL. Override with NEXT_PUBLIC_SITE_URL on Vercel. */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://mashutouping.com';
}

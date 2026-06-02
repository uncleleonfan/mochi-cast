/**
 * Injected via chrome.scripting.executeScript when the content script is not loaded yet.
 * Must be self-contained (no imports).
 */
export function scanVideosInFrame(): {
  videos: Array<{ url: string; title?: string; mimeType?: string; source: string }>;
  pageTitle: string;
  pageUrl: string;
  hints?: { blobVideoCount: number; isBilibili: boolean };
} {
  type Scanner = {
    scan: () => void;
    getVideos: () => Array<{ url: string; title?: string; mimeType?: string; source: string }>;
    getHints?: () => { blobVideoCount: number; isBilibili: boolean };
  };
  const scanner = (window as unknown as { __mochiCastScanner?: Scanner }).__mochiCastScanner;
  if (scanner) {
    scanner.scan();
    return {
      videos: scanner.getVideos(),
      pageTitle: document.title,
      pageUrl: location.href,
      hints: scanner.getHints?.(),
    };
  }

  const videos: Array<{ url: string; title?: string; source: string }> = [];
  const pattern =
    /\.(mp4|webm|mkv|m3u8|m4v|mov)(\?|$)|m3u8|videoplayback|\/video\/|video\/|application\/vnd\.apple\.mpegurl/i;

  const add = (url: string) => {
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;
    try {
      const resolved = new URL(url, document.baseURI).href;
      if (resolved.startsWith('http')) {
        videos.push({ url: resolved, title: document.title, source: 'video-element' });
      }
    } catch {
      /* ignore */
    }
  };

  document.querySelectorAll('video').forEach((el) => {
    add(el.currentSrc || el.src);
    el.querySelectorAll('source').forEach((s) => add(s.src));
  });

  document.querySelectorAll('a[href]').forEach((a) => {
    const href = (a as HTMLAnchorElement).href;
    if (pattern.test(href)) add(href);
  });

  try {
    for (const entry of performance.getEntriesByType('resource')) {
      const name = (entry as PerformanceResourceTiming).name;
      if (pattern.test(name)) add(name);
    }
  } catch {
    /* ignore */
  }

  let blobVideoCount = 0;
  document.querySelectorAll('video').forEach((el) => {
    if ((el.currentSrc || el.src)?.startsWith('blob:')) blobVideoCount++;
  });
  const host = location.hostname;
  return {
    videos,
    pageTitle: document.title,
    pageUrl: location.href,
    hints: {
      blobVideoCount,
      isBilibili: host.includes('bilibili.com') || host.includes('bilibili.tv'),
    },
  };
}

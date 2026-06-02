import type { DetectedVideo } from '../shared/messages.js';

/** URLs we can send to a DLNA TV (http/https, not blob/data). */
export function isCastableUrl(url: string): boolean {
  if (!url?.trim() || url.startsWith('blob:') || url.startsWith('data:')) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const MEDIA_URL_PATTERN =
  /\.(mp4|webm|mkv|m3u8|m4v|mov|m4s|flv)(\?|$)|m3u8|videoplayback|\/video\/|\/stream|video\/|application\/vnd\.apple\.mpegurl|format=mp4|type=video|upgcxcode/i;

const MEDIA_HOST_PATTERN =
  /bilivideo\.com|bilibili\.com|hdslb\.com|googlevideo\.com|akamaized\.net|cloudfront\.net/i;

export function looksLikeMediaUrl(url: string): boolean {
  if (!url) return false;
  return MEDIA_URL_PATTERN.test(url) || MEDIA_HOST_PATTERN.test(url);
}

export interface PageVideoHints {
  blobVideoCount: number;
  isBilibili: boolean;
}

export function getPageVideoHints(): PageVideoHints {
  let blobVideoCount = 0;
  document.querySelectorAll('video').forEach((el) => {
    const src = el.currentSrc || el.src;
    if (src?.startsWith('blob:')) blobVideoCount++;
  });
  const host = location.hostname;
  return {
    blobVideoCount,
    isBilibili: host.includes('bilibili.com') || host.includes('bilibili.tv'),
  };
}

export function createVideoScanner(getTitle: () => string = () => document.title) {
  const videos = new Map<string, DetectedVideo>();
  const hookedVideos = new WeakSet<HTMLVideoElement>();

  function addVideo(video: DetectedVideo) {
    if (!isCastableUrl(video.url)) return;
    const existing = videos.get(video.url);
    if (!existing || (video.title && !existing.title)) {
      videos.set(video.url, video);
    }
  }

  function scanVideoElements() {
    document.querySelectorAll('video').forEach((el, index) => {
      const src = el.currentSrc || el.src;
      if (src) {
        addVideo({
          url: src,
          title: getTitle() || `Video ${index + 1}`,
          mimeType: el.getAttribute('type') ?? undefined,
          source: 'video-element',
        });
      }
      el.querySelectorAll('source').forEach((source) => {
        if (source.src) {
          addVideo({
            url: source.src,
            title: getTitle(),
            mimeType: source.type || undefined,
            source: 'source-tag',
          });
        }
      });
      hookVideoElement(el, index);
    });

    document.querySelectorAll('a[href]').forEach((anchor) => {
      const href = (anchor as HTMLAnchorElement).href;
      if (looksLikeMediaUrl(href)) {
        addVideo({
          url: href,
          title: anchor.textContent?.trim() || getTitle(),
          source: 'page-link',
        });
      }
    });
  }

  function hookVideoElement(el: HTMLVideoElement, index: number) {
    if (hookedVideos.has(el)) return;
    hookedVideos.add(el);
    const refresh = () => {
      const src = el.currentSrc || el.src;
      if (src) {
        addVideo({
          url: src,
          title: getTitle() || `Video ${index + 1}`,
          source: 'video-element',
        });
      }
    };
    for (const event of ['loadedmetadata', 'loadeddata', 'play', 'emptied'] as const) {
      el.addEventListener(event, refresh);
    }
  }

  function scanPerformanceResources() {
    try {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (const entry of entries) {
        if (looksLikeMediaUrl(entry.name)) {
          addVideo({
            url: entry.name,
            title: getTitle(),
            source: 'network',
          });
        }
      }
    } catch {
      /* performance API unavailable */
    }
  }

  function captureFromRequest(input: RequestInfo | URL) {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (isCastableUrl(url) && looksLikeMediaUrl(url)) {
      addVideo({ url, title: getTitle(), source: 'network' });
    }
  }

  function watchResourceTiming() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const name = entry.name;
          if (looksLikeMediaUrl(name)) {
            addVideo({ url: name, title: getTitle(), source: 'network' });
          }
        }
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch {
      /* PerformanceObserver unsupported */
    }
  }

  function scan() {
    scanVideoElements();
    scanPerformanceResources();
  }

  watchResourceTiming();

  return {
    scan,
    getVideos: () => Array.from(videos.values()),
    getHints: getPageVideoHints,
    addVideo,
    captureFromRequest,
  };
}

import type { DetectedVideo } from '../shared/messages.js';
import {
  captureDouyinResponseBody,
  isDouyinFeedHome,
  isDouyinPage,
  looksLikeDouyinMediaUrl,
  refineDouyinFeedVideos,
  requestUrlFromInput,
  scanDouyinRenderData,
  shouldParseDouyinNetworkBody,
} from './douyin-media.js';
import {
  buildVideoTitle,
  extractPageMediaContext,
  type PageMediaContext,
} from './video-title.js';

/** Normalize http(s) URLs (handles unencoded Unicode paths in iframe ?url= params). */
export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return null;
  const attempts = [trimmed, encodeURI(trimmed)];
  for (const attempt of attempts) {
    try {
      const parsed = new URL(attempt);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** URLs we can send to a DLNA TV (http/https, not blob/data). */
export function isCastableUrl(url: string): boolean {
  return normalizeHttpUrl(url) !== null;
}

export const MEDIA_URL_PATTERN =
  /\.(mp4|webm|mkv|m3u8|m4v|mov|m4s|flv)(\?|$)|m3u8|videoplayback|\/video\/|\/stream|video\/|application\/vnd\.apple\.mpegurl|format=mp4|type=video|upgcxcode/i;

const MEDIA_HOST_PATTERN =
  /bilivideo\.com|bilibili\.com|hdslb\.com|googlevideo\.com|akamaized\.net|cloudfront\.net/i;

export function looksLikeMediaUrl(url: string): boolean {
  if (!url) return false;
  return (
    MEDIA_URL_PATTERN.test(url) ||
    MEDIA_HOST_PATTERN.test(url) ||
    looksLikeDouyinMediaUrl(url)
  );
}

/** Query keys used by embedded players (e.g. /m3u8/?url=https://...). */
const MEDIA_QUERY_PARAM_NAMES = [
  'url',
  'src',
  'video',
  'file',
  'stream',
  'link',
  'm3u8',
  'playurl',
  'v',
] as const;

function pushCastableCandidate(found: string[], candidate: string) {
  const trimmed = candidate.trim();
  const normalized = normalizeHttpUrl(trimmed);
  if (!normalized) return;
  if (looksLikeMediaUrl(normalized) || /\.m3u8(\?|$)/i.test(normalized)) {
    found.push(normalized);
  }
}

/** Pull http(s) stream URLs from a page URL, iframe src, or wrapper like /m3u8/?url=…. */
export function extractCastableUrlsFromText(raw: string, base?: string): string[] {
  const found: string[] = [];
  const trimmed = raw?.trim();
  if (!trimmed) return found;

  try {
    const resolved = new URL(trimmed, base ?? document.baseURI);
    for (const name of MEDIA_QUERY_PARAM_NAMES) {
      for (const value of resolved.searchParams.getAll(name)) {
        try {
          pushCastableCandidate(found, decodeURIComponent(value));
        } catch {
          pushCastableCandidate(found, value);
        }
        try {
          pushCastableCandidate(found, new URL(decodeURIComponent(value), resolved.href).href);
        } catch {
          /* ignore */
        }
      }
    }
    if (/\.(mp4|webm|mkv|m3u8|m4v|mov|m4s|flv)(\?|$)/i.test(resolved.pathname)) {
      pushCastableCandidate(found, resolved.href);
    }
  } catch {
    pushCastableCandidate(found, trimmed);
  }

  return [...new Set(found)];
}

const IFRAME_URL_ATTRS = ['src', 'data-src', 'data-url', 'data-video', 'data-stream'] as const;

export function scanIframeMediaSources(
  onUrl: (url: string) => void,
  root: Document | ShadowRoot = document,
): void {
  root.querySelectorAll('iframe').forEach((iframe) => {
    for (const attr of IFRAME_URL_ATTRS) {
      const value = (iframe.getAttribute(attr) || '').trim();
      if (!value || value === 'about:blank') continue;
      for (const url of extractCastableUrlsFromText(value, document.baseURI)) {
        onUrl(url);
      }
    }
    const liveSrc = (iframe.src || '').trim();
    if (liveSrc && liveSrc !== 'about:blank') {
      for (const url of extractCastableUrlsFromText(liveSrc, document.baseURI)) {
        onUrl(url);
      }
    }
  });
}

export function scanPageLocationMedia(onUrl: (url: string) => void): void {
  for (const url of extractCastableUrlsFromText(location.href)) {
    onUrl(url);
  }
}

/** Decode JSON-in-script escapes (slsuliao/MacPlayer: https:\/\/ and \\u7b2c01). */
export function decodePageTextEscapes(text: string): string {
  return text
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const PAGE_TEXT_MEDIA_PATTERNS = [
  /https?:\/\/[^\s"'<>\\]+?\.m3u8[^\s"'<>\\]*/gi,
  /https?:\/\/[^\s"'<>\\]+?\.(?:mp4|webm|mkv|m4v)(?:\?[^\s"'<>\\]*)?/gi,
  /[?&]url=(https?%3A%2F%2F[^"'&\s<>]+)/gi,
  /[?&]url=(https?:\/\/[^"'&\s<>]+)/gi,
  /"url"\s*:\s*"(https?:[^"]+?\.m3u8[^"]*)"/gi,
  /"url_next"\s*:\s*"(https?:[^"]+?\.m3u8[^"]*)"/gi,
];

/** Scan HTML or inline script text for media URLs (after JSON escape decoding). */
export function scanPageTextForMediaUrls(
  text: string,
  base: string,
  onUrl: (url: string) => void,
): number {
  let hits = 0;
  const decoded = decodePageTextEscapes(text);

  for (const pattern of PAGE_TEXT_MEDIA_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of decoded.matchAll(pattern)) {
      let raw = (match[1] ?? match[0]).trim();
      if (raw.startsWith('url=')) raw = raw.slice(4);
      try {
        raw = decodeURIComponent(raw);
      } catch {
        /* keep raw */
      }
      const batch = raw.includes('://')
        ? extractCastableUrlsFromText(raw, base)
        : extractCastableUrlsFromText(`?url=${raw}`, base);
      for (const url of batch) {
        hits++;
        onUrl(url);
      }
    }
  }
  return hits;
}

export function scanInlineScriptsForMedia(
  onUrl: (url: string) => void,
  root: Document | ShadowRoot = document,
): number {
  let hits = 0;
  const onDouyin = isDouyinPage();
  root.querySelectorAll('script:not([src])').forEach((script) => {
    const text = script.textContent ?? '';
    if (
      onDouyin &&
      (script.id === 'RENDER_DATA' ||
        text.includes('play_addr') ||
        text.includes('url_list') ||
        text.includes('douyinvod'))
    ) {
      hits += captureDouyinResponseBody(text, onUrl);
      return;
    }
    if (!text.includes('m3u8') && !text.includes('player_')) return;
    hits += scanPageTextForMediaUrls(text, document.baseURI, onUrl);
  });
  return hits;
}

  /** Scan raw HTML for iframe src, ?url= wrappers, and player_aaaa JSON. */
export function scanDocumentHtmlForMedia(
  onUrl: (url: string) => void,
  root: Document | ShadowRoot = document,
): number {
  let hits = 0;
  if (isDouyinPage()) {
    hits += scanDouyinRenderData(onUrl);
  }
  const html =
    root instanceof Document ? root.documentElement.innerHTML.slice(0, 1_500_000) : '';
  if (!html) return hits;
  hits += scanPageTextForMediaUrls(html, document.baseURI, onUrl);
  if (isDouyinPage()) {
    hits += captureDouyinResponseBody(html, onUrl);
  }
  return hits + scanInlineScriptsForMedia(onUrl, root);
}

export interface FrameVideoScanMeta {
  frameUrl: string;
  iframeCount: number;
  iframeSrcSamples: string[];
  videoElementCount: number;
  blobVideoCount: number;
  htmlMediaHits: number;
}

export function collectFrameScanMeta(root: Document | ShadowRoot = document): FrameVideoScanMeta {
  const iframeSrcSamples: string[] = [];
  let videoElementCount = 0;
  let blobVideoCount = 0;

  root.querySelectorAll('iframe').forEach((iframe) => {
    const src = (
      iframe.getAttribute('src') ||
      iframe.getAttribute('data-src') ||
      iframe.src ||
      ''
    ).trim();
    if (src && src !== 'about:blank' && iframeSrcSamples.length < 4) {
      iframeSrcSamples.push(src.length > 120 ? `${src.slice(0, 120)}…` : src);
    }
  });

  forEachVideoElement((el) => {
    videoElementCount++;
    const src = getVideoElementUrl(el);
    if (src.startsWith('blob:')) blobVideoCount++;
  });

  return {
    frameUrl: location.href,
    iframeCount: root.querySelectorAll('iframe').length,
    iframeSrcSamples,
    videoElementCount,
    blobVideoCount,
    htmlMediaHits: 0,
  };
}

export interface PageVideoHints {
  blobVideoCount: number;
  isBilibili: boolean;
  isDouyin: boolean;
}

/** Read playable URL from a &lt;video&gt; (property or attribute). */
export function getVideoElementUrl(el: HTMLVideoElement): string {
  return (el.currentSrc || el.src || el.getAttribute('src') || '').trim();
}

/** Walk document + open shadow roots (many players hide &lt;video&gt; inside shadow DOM). */
export function forEachVideoElement(
  callback: (el: HTMLVideoElement, index: number) => void,
  root: Document | ShadowRoot = document,
): void {
  const seen = new Set<HTMLVideoElement>();
  let index = 0;
  const visit = (node: Document | ShadowRoot) => {
    node.querySelectorAll('video').forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      callback(el, index++);
    });
    node.querySelectorAll('*').forEach((el) => {
      if (el instanceof HTMLElement && el.shadowRoot) visit(el.shadowRoot);
    });
  };
  visit(root);
}

export function getPageVideoHints(): PageVideoHints {
  let blobVideoCount = 0;
  forEachVideoElement((el) => {
    const src = getVideoElementUrl(el);
    if (src.startsWith('blob:')) blobVideoCount++;
  });
  const host = location.hostname;
  return {
    blobVideoCount,
    isBilibili: host.includes('bilibili.com') || host.includes('bilibili.tv'),
    isDouyin: isDouyinPage(host),
  };
}

function pickRicherTitle(a?: string, b?: string): string | undefined {
  if (!a?.trim()) return b?.trim();
  if (!b?.trim()) return a.trim();
  const score = (t: string) => {
    let s = 0;
    if (t.includes(' · ')) s += 4;
    if (/[\u4e00-\u9fff]/.test(t)) s += 2;
    if (!/^https?:\/\//i.test(t)) s += 2;
    if (t.length < 80) s += 1;
    return s;
  };
  return score(b) > score(a) ? b : a;
}

const CDN_CAPTURE_TTL_MS = 30_000;
const CDN_BLOB_LINK_MAX_AGE_MS = 10_000;

export function createVideoScanner() {
  const videos = new Map<string, DetectedVideo>();
  const hookedVideos = new WeakSet<HTMLVideoElement>();
  let mediaContext: PageMediaContext | null = null;
  /** blob 播放前刚拉到的 http CDN，用于关联 xgplayer / MSE */
  const recentCdnCaptures: { url: string; at: number }[] = [];

  function getContext(): PageMediaContext {
    if (!mediaContext) mediaContext = extractPageMediaContext();
    return mediaContext;
  }

  function recordCdnCapture(url: string) {
    const normalized = normalizeHttpUrl(url);
    if (!normalized) return;
    const now = Date.now();
    recentCdnCaptures.push({ url: normalized, at: now });
    while (
      recentCdnCaptures.length > 0 &&
      now - recentCdnCaptures[0].at > CDN_CAPTURE_TTL_MS
    ) {
      recentCdnCaptures.shift();
    }
    if (recentCdnCaptures.length > 40) recentCdnCaptures.splice(0, recentCdnCaptures.length - 40);
  }

  /** blob: 无法投屏；尝试绑定此前数秒内捕获的 CDN 直链。 */
  function tryLinkBlobVideoToRecentCdn(el: HTMLVideoElement, fallbackIndex?: number) {
    const src = getVideoElementUrl(el);
    if (!src.startsWith('blob:')) return;
    const now = Date.now();
    for (let i = recentCdnCaptures.length - 1; i >= 0; i--) {
      const entry = recentCdnCaptures[i];
      if (now - entry.at > CDN_BLOB_LINK_MAX_AGE_MS) break;
      addVideo({ url: entry.url, source: 'network' }, fallbackIndex);
      return;
    }
  }

  function addVideo(video: DetectedVideo, fallbackIndex?: number) {
    const normalized = normalizeHttpUrl(video.url);
    if (!normalized) return;
    recordCdnCapture(normalized);
    const title =
      video.title?.trim() || buildVideoTitle(normalized, getContext(), fallbackIndex);
    const entry: DetectedVideo = { ...video, url: normalized, title };
    const existing = videos.get(normalized);
    if (!existing) {
      videos.set(normalized, entry);
      return;
    }
    const mergedTitle = pickRicherTitle(existing.title, entry.title);
    videos.set(normalized, { ...existing, ...entry, title: mergedTitle });
  }

  function scanVideoElements() {
    forEachVideoElement((el, index) => {
      const src = getVideoElementUrl(el);
      if (src) {
        addVideo(
          {
            url: src,
            mimeType: el.getAttribute('type') ?? undefined,
            source: 'video-element',
          },
          index,
        );
      }
      el.querySelectorAll('source').forEach((source) => {
        if (source.src) {
          addVideo({
            url: source.src,
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
          title: anchor.textContent?.trim() || undefined,
          source: 'page-link',
        });
      }
    });

    scanIframeMediaSources((url) => {
      addVideo({ url, source: 'iframe-src' });
    });
    scanPageLocationMedia((url) => {
      addVideo({ url, source: 'page-query' });
    });
    scanDocumentHtmlForMedia((url) => {
      addVideo({ url, source: 'script-json' });
    });
  }

  function hookVideoElement(el: HTMLVideoElement, index: number) {
    if (hookedVideos.has(el)) return;
    hookedVideos.add(el);
    const refresh = () => {
      const src = getVideoElementUrl(el);
      if (src.startsWith('blob:')) {
        tryLinkBlobVideoToRecentCdn(el, index);
        return;
      }
      if (src) addVideo({ url: src, source: 'video-element' }, index);
    };
    for (const event of ['loadedmetadata', 'loadeddata', 'play', 'emptied'] as const) {
      el.addEventListener(event, refresh);
    }
    refresh();
  }

  function scanPerformanceResources() {
    try {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      for (const entry of entries) {
        if (looksLikeMediaUrl(entry.name)) {
          addVideo({ url: entry.name, source: 'network' });
        }
      }
    } catch {
      /* performance API unavailable */
    }
  }

  function captureFromRequest(input: RequestInfo | URL) {
    const url = requestUrlFromInput(input);
    if (isCastableUrl(url) && looksLikeMediaUrl(url)) {
      addVideo({ url, source: 'network' });
    }
  }

  async function captureFromFetchResponse(
    input: RequestInfo | URL,
    response: Response,
  ): Promise<void> {
    if (!isDouyinPage()) return;
    const reqUrl = requestUrlFromInput(input);
    if (!shouldParseDouyinNetworkBody(reqUrl)) return;
    try {
      const ct = response.headers.get('content-type') ?? '';
      if (!/json|text|javascript/i.test(ct) && !shouldParseDouyinNetworkBody(reqUrl)) {
        return;
      }
      const text = await response.text();
      captureDouyinResponseBody(text, (url) => {
        addVideo({ url, source: 'script-json' });
      });
    } catch {
      /* body unreadable */
    }
  }

  function captureFromXhr(xhr: XMLHttpRequest) {
    if (!isDouyinPage()) return;
    const reqUrl = xhr.responseURL || '';
    if (!shouldParseDouyinNetworkBody(reqUrl)) return;
    try {
      const text =
        typeof xhr.response === 'string'
          ? xhr.response
          : xhr.responseType === '' || xhr.responseType === 'text'
            ? xhr.responseText
            : '';
      if (text) {
        captureDouyinResponseBody(text, (url) => {
          addVideo({ url, source: 'script-json' });
        });
      }
    } catch {
      /* ignore */
    }
  }

  function watchResourceTiming() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const name = entry.name;
          if (looksLikeMediaUrl(name)) {
            addVideo({ url: name, source: 'network' });
          }
        }
      });
      observer.observe({ entryTypes: ['resource'] });
    } catch {
      /* PerformanceObserver unsupported */
    }
  }

  function scan() {
    mediaContext = null;
    scanVideoElements();
    if (isDouyinPage()) {
      scanDouyinRenderData((url) => addVideo({ url, source: 'script-json' }));
    }
    scanPerformanceResources();
    lastFrameMeta = buildFrameMeta();
  }

  function buildFrameMeta(): FrameVideoScanMeta {
    const meta = collectFrameScanMeta();
    meta.htmlMediaHits = scanDocumentHtmlForMedia((url) => {
      addVideo({ url, source: 'script-json' });
    });
    return meta;
  }

  let lastFrameMeta: FrameVideoScanMeta | null = null;

  watchResourceTiming();

  return {
    scan,
    getVideos: () => {
      const list = Array.from(videos.values());
      if (isDouyinPage() && isDouyinFeedHome(location.href)) {
        return refineDouyinFeedVideos(list, location.href, document.title, {
          doc: document,
        });
      }
      return list;
    },
    getHints: getPageVideoHints,
    getFrameMeta: () => lastFrameMeta ?? buildFrameMeta(),
    addVideo,
    captureFromRequest,
    captureFromFetchResponse,
    captureFromXhr,
  };
}

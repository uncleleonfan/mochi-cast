import {
  extractPlayUrlsForAwemeId,
  getDouyinModalId,
  refineDouyinFeedVideos,
} from './douyin-media.js';

/**
 * Injected via chrome.scripting.executeScript when the content script is not loaded yet.
 */
export function scanVideosInFrame(): {
  videos: Array<{ url: string; title?: string; mimeType?: string; source: string }>;
  pageTitle: string;
  pageUrl: string;
  hints?: { blobVideoCount: number; isBilibili: boolean; isDouyin: boolean };
  frameMeta?: {
    frameUrl: string;
    iframeCount: number;
    iframeSrcSamples: string[];
    videoElementCount: number;
    blobVideoCount: number;
    htmlMediaHits: number;
  };
  douyinModal?: { modalId: string; streamUrls: string[] };
} {
  type Scanner = {
    scan: () => void;
    getVideos: () => Array<{ url: string; title?: string; mimeType?: string; source: string }>;
    getHints?: () => { blobVideoCount: number; isBilibili: boolean; isDouyin: boolean };
    getFrameMeta?: () => {
      frameUrl: string;
      iframeCount: number;
      iframeSrcSamples: string[];
      videoElementCount: number;
      blobVideoCount: number;
      htmlMediaHits: number;
    };
  };
  const scanner = (window as unknown as { __mochiCastScanner?: Scanner }).__mochiCastScanner;
  if (scanner) {
    scanner.scan();
    return {
      videos: scanner.getVideos(),
      pageTitle: document.title,
      pageUrl: location.href,
      hints: scanner.getHints?.(),
      frameMeta: scanner.getFrameMeta?.(),
    };
  }

  const videos: Array<{ url: string; title?: string; source: string }> = [];
  const seen = new Set<string>();
  const pattern =
    /\.(mp4|webm|mkv|m3u8|m4v|mov)(\?|$)|m3u8|videoplayback|\/video\/|video\/|application\/vnd\.apple\.mpegurl/i;
  const queryKeys = ['url', 'src', 'video', 'file', 'stream', 'link', 'm3u8', 'playurl', 'v'];
  const htmlPatterns = [
    /https?:\/\/[^\s"'<>\\]+?\.m3u8[^\s"'<>\\]*/gi,
    /[?&]url=(https?%3A%2F%2F[^"'&\s<>]+)/gi,
    /[?&]url=(https?:\/\/[^"'&\s<>]+)/gi,
  ];

  const normalizeHttp = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return null;
    for (const attempt of [trimmed, encodeURI(trimmed)]) {
      try {
        const parsed = new URL(attempt);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
      } catch {
        /* next */
      }
    }
    return null;
  };

  const decodeEscapes = (text: string) =>
    text
      .replace(/\\\//g, '/')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      );

  const episodeFromPath = (url: string): string | undefined => {
    try {
      const path = decodeURIComponent(new URL(url).pathname);
      const ep = path.match(/第\d+集/)?.[0];
      if (ep) return ep;
      const file = path.split('/').filter(Boolean).pop();
      if (file && file !== 'index.m3u8') return file.replace(/\.m3u8$/i, '');
    } catch {
      /* ignore */
    }
    return undefined;
  };

  const host = location.hostname;
  const isDouyin =
    host.includes('douyin.com') || host.includes('iesdouyin.com');

  let vodName: string | undefined;
  const urlLabels = new Map<string, string>();
  const docTitle = document.title.trim();
  const playingMatch = docTitle.match(/(?:正在为您播放|正在播放|播放)(.+?)(?:\s*[-–|]\s*|$)/);
  const docShort = playingMatch?.[1]?.trim() || docTitle.replace(/\s*[-–|]\s*[^-–|]{2,40}$/, '').trim();

  const titleFor = (url: string): string => {
    if (isDouyin) {
      try {
        const tail = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
        if (tail.toLowerCase() === 'play') return 'play';
      } catch {
        /* ignore */
      }
    }
    const parts: string[] = [];
    if (vodName) parts.push(vodName);
    const ep = urlLabels.get(url) ?? episodeFromPath(url);
    if (ep && !parts.includes(ep)) parts.push(ep);
    if (parts.length > 0) return parts.join(' · ');
    if (docShort) return ep ? `${docShort} · ${ep}` : docShort;
    return ep ?? docTitle;
  };

  document.querySelectorAll('script:not([src])').forEach((script) => {
    const raw = script.textContent ?? '';
    if (!raw.includes('m3u8') && !raw.includes('vod_') && !raw.includes('player_')) return;
    const decoded = decodeEscapes(raw);
    const vn = decoded.match(/"vod_name"\s*:\s*"([^"]+)"/)?.[1];
    if (vn && (!vodName || vn.length > vodName.length)) vodName = vn;
    for (const m of decoded.matchAll(/"url(_next)?"\s*:\s*"(https?:[^"]+?\.m3u8[^"]*)"/gi)) {
      const href = normalizeHttp(m[2]);
      if (!href) continue;
      const label = episodeFromPath(href) ?? (m[1] ? '下一集' : undefined);
      if (label) urlLabels.set(href, label);
    }
  });

  const add = (url: string, source = 'video-element') => {
    let resolved = normalizeHttp(url);
    if (!resolved) {
      try {
        resolved = normalizeHttp(new URL(url, document.baseURI).href);
      } catch {
        resolved = null;
      }
    }
    if (!resolved || seen.has(resolved)) return;
    if (!pattern.test(resolved) && !/\.m3u8/i.test(resolved)) return;
    seen.add(resolved);
    videos.push({ url: resolved, title: titleFor(resolved), source });
  };

  const extractFromText = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    try {
      const resolved = new URL(trimmed, document.baseURI);
      for (const key of queryKeys) {
        for (const value of resolved.searchParams.getAll(key)) {
          try {
            add(decodeURIComponent(value), 'iframe-src');
          } catch {
            add(value, 'iframe-src');
          }
        }
      }
      if (/\.(mp4|webm|mkv|m3u8|m4v|mov)(\?|$)/i.test(resolved.pathname)) {
        add(resolved.href, 'page-query');
      }
    } catch {
      if (pattern.test(trimmed)) add(trimmed, 'iframe-src');
    }
  };

  let blobVideoCount = 0;
  let videoElementCount = 0;
  const iframeSrcSamples: string[] = [];

  const visit = (node: Document | ShadowRoot) => {
    node.querySelectorAll('video').forEach((el) => {
      videoElementCount++;
      const src = el.currentSrc || el.src || el.getAttribute('src') || '';
      if (src.startsWith('blob:')) blobVideoCount++;
      add(src);
      el.querySelectorAll('source').forEach((s) => add(s.src || s.getAttribute('src') || ''));
    });
    node.querySelectorAll('*').forEach((el) => {
      if (el instanceof HTMLElement && el.shadowRoot) visit(el.shadowRoot);
    });
  };
  visit(document);

  const iframeAttrs = ['src', 'data-src', 'data-url', 'data-video', 'data-stream'];
  document.querySelectorAll('iframe').forEach((iframe) => {
    for (const attr of iframeAttrs) {
      const src = (iframe.getAttribute(attr) || (attr === 'src' ? iframe.src : '') || '').trim();
      if (!src || src === 'about:blank') continue;
      if (iframeSrcSamples.length < 4) {
        iframeSrcSamples.push(src.length > 120 ? `${src.slice(0, 120)}…` : src);
      }
      extractFromText(src);
    }
  });
  extractFromText(location.href);

  let htmlMediaHits = 0;
  const scanTextChunk = (text: string) => {
    const decoded = decodeEscapes(text);
    const patterns = [
      ...htmlPatterns,
      /"url"\s*:\s*"(https?:[^"]+?\.m3u8[^"]*)"/gi,
      /https?:\/\/[^\s"'<>]+?\.m3u8/gi,
    ];
    for (const re of patterns) {
      re.lastIndex = 0;
      for (const match of decoded.matchAll(re)) {
        let raw = (match[1] ?? match[0]).trim();
        if (raw.startsWith('url=')) raw = raw.slice(4);
        try {
          raw = decodeURIComponent(raw);
        } catch {
          /* keep */
        }
        const before = seen.size;
        extractFromText(raw.includes('://') ? raw : `?url=${raw}`);
        if (seen.size > before) htmlMediaHits += seen.size - before;
      }
    }
  };

  const douyinCdn =
    /douyinvod|zjcdn|byte(?:ic)?cdn/i;
  const douyinPath =
    /\/video\/|mime_type=video|bytevc1|tos\/cn\//i;
  const addDouyinUrl = (raw: string) => {
    const u = normalizeHttp(raw.replace(/\\\//g, '/'));
    if (!u || !douyinCdn.test(u) || !douyinPath.test(u)) return;
    add(u, 'script-json');
  };
  const scanDouyinChunk = (text: string) => {
    let chunk = text.trim();
    try {
      if (chunk.includes('%7B') || chunk.startsWith('%')) chunk = decodeURIComponent(chunk);
    } catch {
      /* keep */
    }
    const decoded = decodeEscapes(chunk);
    if (decoded.startsWith('{') || decoded.startsWith('[')) {
      try {
        const walk = (v: unknown) => {
          if (typeof v === 'string') addDouyinUrl(v);
          else if (Array.isArray(v)) v.forEach(walk);
          else if (v && typeof v === 'object')
            Object.values(v as Record<string, unknown>).forEach(walk);
        };
        walk(JSON.parse(decoded));
      } catch {
        /* regex fallback */
      }
    }
    for (const m of decoded.matchAll(/https?:\/\/[^\s"'<>\\]+douyinvod[^\s"'<>\\]*/gi)) {
      addDouyinUrl(m[0]);
    }
  };

  scanTextChunk(document.documentElement.innerHTML.slice(0, 1_500_000));
  if (isDouyin) {
    const render = document.getElementById('RENDER_DATA');
    if (render?.textContent) scanDouyinChunk(render.textContent);
    scanDouyinChunk(document.documentElement.innerHTML.slice(0, 800_000));
  }
  document.querySelectorAll('script:not([src])').forEach((script) => {
    const text = script.textContent ?? '';
    if (isDouyin && (script.id === 'RENDER_DATA' || text.includes('play_addr'))) {
      scanDouyinChunk(text);
      return;
    }
    if (text.includes('m3u8') || text.includes('player_')) scanTextChunk(text);
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

  const feedPath = location.pathname.replace(/\/$/, '') || '/';
  const isDouyinFeed =
    isDouyin &&
    (feedPath === '/' || feedPath === '/jingxuan' || feedPath === '/discover' || feedPath === '/hot');
  const modalId = getDouyinModalId(location.href);
  const modalStreamUrls = modalId ? extractPlayUrlsForAwemeId(document, modalId) : [];
  const finalVideos = isDouyinFeed
    ? refineDouyinFeedVideos(videos, location.href, docTitle, {
        doc: document,
        modalStreamUrls,
      })
    : videos;

  return {
    videos: finalVideos,
    pageTitle: document.title,
    pageUrl: location.href,
    douyinModal: modalId ? { modalId, streamUrls: modalStreamUrls } : undefined,
    hints: {
      blobVideoCount,
      isBilibili: host.includes('bilibili.com') || host.includes('bilibili.tv'),
      isDouyin,
    },
    frameMeta: {
      frameUrl: location.href,
      iframeCount: document.querySelectorAll('iframe').length,
      iframeSrcSamples,
      videoElementCount,
      blobVideoCount,
      htmlMediaHits,
    },
  };
}

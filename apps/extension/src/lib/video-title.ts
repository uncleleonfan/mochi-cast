import { decodePageTextEscapes, normalizeHttpUrl } from './video-scanner.js';

export interface PageMediaContext {
  documentTitle: string;
  vodName?: string;
  /** Per-stream label (e.g. 第01集, 下一集). */
  urlLabels: Map<string, string>;
}

/** Episode / part label from m3u8 URL path. */
export function episodeLabelFromUrl(url: string): string | undefined {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const cnEp = path.match(/第\d+集/)?.[0];
    if (cnEp) return cnEp;
    const segments = path.split('/').filter(Boolean);
    const file = segments[segments.length - 1];
    if (file && file !== 'index.m3u8') {
      return file.replace(/\.m3u8$/i, '');
    }
    const parent = segments[segments.length - 2];
    if (parent && !/^[a-z0-9_-]+$/i.test(parent)) return parent;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Trim site suffix from document.title (e.g. "… - 番茄影视"). */
export function cleanDocumentTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed) return undefined;
  const playing = trimmed.match(/(?:正在为您播放|正在播放|播放)(.+?)(?:\s*[-–|]\s*|$)/);
  if (playing?.[1]) return playing[1].trim();
  const stripped = trimmed
    .replace(/\s*[-–|]\s*[^-–|]{2,40}$/, '')
    .replace(/\s*(在线播放|免费观看|高清).*$/i, '')
    .trim();
  return stripped || trimmed;
}

export function extractPageMediaContext(root: Document = document): PageMediaContext {
  const ctx: PageMediaContext = {
    documentTitle: document.title.trim(),
    urlLabels: new Map(),
  };

  root.querySelectorAll('script:not([src])').forEach((script) => {
    const raw = script.textContent ?? '';
    if (!raw.includes('m3u8') && !raw.includes('vod_') && !raw.includes('player_')) return;

    const decoded = decodePageTextEscapes(raw);

    const vodName =
      decoded.match(/"vod_name"\s*:\s*"([^"]+)"/)?.[1] ??
      decoded.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
    if (vodName && (!ctx.vodName || vodName.length > ctx.vodName.length)) {
      ctx.vodName = vodName;
    }

    for (const match of decoded.matchAll(
      /"url(_next)?"\s*:\s*"(https?:[^"]+?\.m3u8[^"]*)"/gi,
    )) {
      const normalized = normalizeHttpUrl(match[2]);
      if (!normalized) continue;
      const fromPath = episodeLabelFromUrl(normalized);
      const label = fromPath ?? (match[1] ? '下一集' : undefined);
      if (label) ctx.urlLabels.set(normalized, label);
    }
  });

  return ctx;
}

export function buildVideoTitle(
  url: string,
  ctx: PageMediaContext,
  fallbackIndex?: number,
): string {
  const parts: string[] = [];
  if (ctx.vodName) parts.push(ctx.vodName);

  const ep = ctx.urlLabels.get(url) ?? episodeLabelFromUrl(url);
  if (ep && !parts.includes(ep)) parts.push(ep);

  if (parts.length > 0) return parts.join(' · ');

  const fromDoc = cleanDocumentTitle(ctx.documentTitle);
  if (fromDoc) {
    if (ep) return `${fromDoc} · ${ep}`;
    return fromDoc;
  }

  if (ep) return ep;

  try {
    const tail = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    if (tail && tail !== 'index.m3u8' && tail.toLowerCase() !== 'play') {
      return tail.replace(/\.m3u8$/i, '');
    }
    if (tail?.toLowerCase() === 'play') {
      const fromDoc = cleanDocumentTitle(ctx.documentTitle);
      if (fromDoc) return fromDoc;
    }
  } catch {
    /* ignore */
  }

  if (fallbackIndex != null) return `Video ${fallbackIndex + 1}`;
  return url.length > 56 ? `${url.slice(0, 56)}…` : url;
}

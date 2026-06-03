function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw?.trim();
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
}

function isCastableUrl(url: string): boolean {
  return normalizeHttpUrl(url) !== null;
}

function decodePageTextEscapes(text: string): string {
  return text
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

const DOUYIN_HOST =
  /(^|\.)douyin\.com$|(^|\.)iesdouyin\.com$|(^|\.)douyinpic\.com$/i;

const DOUYIN_CDN_HOST =
  /douyin(?:vod)?\.com|zjcdn\.com|byte(?:ic)?cdn\.com|ixigua\.com|amemv\.com|snssdk\.com|bytedns\.com|pstatp\.com/i;

/** Paths / query hints for ByteDance video CDNs (often no .mp4 suffix). */
const DOUYIN_MEDIA_PATH =
  /\/video\/|mime_type=video|bytevc1|tos\/cn\/|media-video|playwm|playaddr|\/obj\/|\/tos\//i;

const DOUYIN_API_PATH =
  /aweme|\/video\/|\/play\/|detail|modal|feed|recommend|jingxuan|item|aweme\/v\d/i;

const DOUYIN_TEXT_URL =
  /https?:\/\/[^\s"'<>\\]+?(?:douyinvod|zjcdn|byte(?:ic)?cdn|ixigua|amemv)[^\s"'<>\\]*/gi;

const DOUYIN_JSON_URL =
  /"(?:https?:)?(?:\\\/|\/)[^"]*(?:douyinvod|zjcdn|byte(?:ic)?cdn)[^"]*"/gi;

const MAX_RESPONSE_BYTES = 3_000_000;

export function isDouyinHost(hostname: string): boolean {
  return DOUYIN_HOST.test(hostname.trim());
}

export function isDouyinPage(hostname = location.hostname): boolean {
  return isDouyinHost(hostname);
}

export function looksLikeDouyinMediaUrl(url: string): boolean {
  if (!url?.trim()) return false;
  const decoded = url.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  if (!DOUYIN_CDN_HOST.test(decoded)) return false;
  return (
    DOUYIN_MEDIA_PATH.test(decoded) ||
    /\.(mp4|m3u8|m4s)(\?|$)/i.test(decoded) ||
    /mime_type=video|type=video/i.test(decoded)
  );
}

export function shouldParseDouyinNetworkBody(requestUrl: string): boolean {
  if (!requestUrl) return false;
  try {
    const u = new URL(requestUrl, location.href);
    if (!isDouyinHost(u.hostname) && !DOUYIN_CDN_HOST.test(u.hostname)) return false;
    if (DOUYIN_CDN_HOST.test(u.hostname)) return true;
    return DOUYIN_API_PATH.test(u.pathname + u.search);
  } catch {
    return DOUYIN_API_PATH.test(requestUrl);
  }
}

function pushDouyinUrl(found: Set<string>, raw: string) {
  let s = raw.trim();
  if (!s) return;
  s = decodePageTextEscapes(s.replace(/^"+|"+$/g, ''));
  const normalized = normalizeHttpUrl(s);
  if (!normalized) return;
  if (looksLikeDouyinMediaUrl(normalized)) found.add(normalized);
}

export function extractDouyinUrlsFromJson(value: unknown, found = new Set<string>()): Set<string> {
  if (value == null) return found;

  if (typeof value === 'string') {
    if (looksLikeDouyinMediaUrl(value)) pushDouyinUrl(found, value);
    else if (
      (value.startsWith('{') || value.startsWith('[')) &&
      value.length < 500_000
    ) {
      try {
        extractDouyinUrlsFromJson(JSON.parse(value), found);
      } catch {
        /* not JSON */
      }
    }
    return found;
  }

  if (Array.isArray(value)) {
    for (const item of value) extractDouyinUrlsFromJson(item, found);
    return found;
  }

  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      extractDouyinUrlsFromJson(v, found);
    }
  }
  return found;
}

/** Parse API / RENDER_DATA text (JSON or escaped JSON in HTML). */
export function captureDouyinResponseBody(
  text: string,
  onUrl: (url: string) => void,
): number {
  if (!text || text.length > MAX_RESPONSE_BYTES) return 0;
  const found = new Set<string>();

  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('%7B')) {
    let jsonText = trimmed;
    try {
      if (trimmed.includes('%')) jsonText = decodeURIComponent(trimmed);
    } catch {
      /* keep */
    }
    try {
      extractDouyinUrlsFromJson(JSON.parse(jsonText), found);
    } catch {
      /* fall through to regex */
    }
  }

  const decoded = decodePageTextEscapes(text);
  for (const match of decoded.matchAll(DOUYIN_TEXT_URL)) {
    pushDouyinUrl(found, match[0]);
  }
  for (const match of decoded.matchAll(DOUYIN_JSON_URL)) {
    pushDouyinUrl(found, match[0]);
  }

  let hits = 0;
  for (const url of found) {
    if (isCastableUrl(url)) {
      hits++;
      onUrl(url);
    }
  }
  return hits;
}

export function scanDouyinRenderData(onUrl: (url: string) => void): number {
  let hits = 0;
  const nodes: Element[] = [];
  const byId = document.getElementById('RENDER_DATA');
  if (byId) nodes.push(byId);
  document
    .querySelectorAll('script#RENDER_DATA, script[type="application/json"]')
    .forEach((el) => {
      if (!nodes.includes(el)) nodes.push(el);
    });

  for (const el of nodes) {
    const raw = el.textContent?.trim();
    if (!raw) continue;
    hits += captureDouyinResponseBody(raw, onUrl);
  }
  return hits;
}

export function scanDouyinPageText(
  text: string,
  onUrl: (url: string) => void,
): number {
  return captureDouyinResponseBody(text, onUrl);
}

export function requestUrlFromInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** 精选弹窗等 URL 上的 modal_id（对应该条 aweme）。 */
export function getDouyinModalId(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!isDouyinHost(u.hostname)) return null;
    const path = u.pathname.replace(/\/$/, '') || '/';
    if (path !== '/' && path !== '/jingxuan' && path !== '/discover' && path !== '/hot') {
      return null;
    }
    return u.searchParams.get('modal_id');
  } catch {
    return null;
  }
}

/** Feed / 精选等首页流，非独立 /video/ 详情页。 */
export function isDouyinFeedHome(pageUrl: string): boolean {
  try {
    const u = new URL(pageUrl);
    if (!isDouyinHost(u.hostname)) return false;
    const path = u.pathname.replace(/\/$/, '') || '/';
    if (path === '/' || path === '/jingxuan' || path === '/discover' || path === '/hot') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isDouyinPlayTitle(title?: string): boolean {
  const t = title?.trim().toLowerCase();
  return t === 'play';
}

/** 当前正在播放的 douyinvod 直链（路径常含 /play 或以 play 结尾）。 */
export function isDouyinActiveStreamUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!looksLikeDouyinMediaUrl(url)) return false;
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();
    if (last === 'play') return true;
    return /\/play\/|playaddr|playwm/i.test(u.pathname + u.search);
  } catch {
    return /\/play\b|playaddr|playwm/i.test(url);
  }
}

function cleanDouyinDocumentTitle(title: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed || trimmed === '抖音' || isDouyinNoiseTitle(trimmed)) return undefined;
  const dash = trimmed.match(/^(.+?)\s*[-–|]\s*抖音\s*$/);
  if (dash?.[1] && dash[1].length > 2 && !isDouyinNoiseTitle(dash[1])) return dash[1].trim();
  if (!/抖音/.test(trimmed) && trimmed.length > 2) return trimmed;
  return undefined;
}

function collectRenderChunks(doc: Document): string[] {
  const chunks: string[] = [];
  const byId = doc.getElementById('RENDER_DATA');
  if (byId?.textContent?.trim()) chunks.push(byId.textContent.trim());
  doc
    .querySelectorAll('script#RENDER_DATA, script[type="application/json"]')
    .forEach((el) => {
      const t = el.textContent?.trim();
      if (t && !chunks.includes(t)) chunks.push(t);
    });
  return chunks;
}

function parseRenderJson(raw: string): unknown | null {
  let text = raw.trim();
  try {
    if (text.includes('%7B') || (text.includes('%') && text.startsWith('%'))) {
      text = decodeURIComponent(text);
    }
  } catch {
    /* keep */
  }
  try {
    return JSON.parse(decodePageTextEscapes(text));
  } catch {
    return null;
  }
}

const LAYOUT_TITLE_SELECTORS = [
  '[data-e2e="video-desc"]',
  '[data-e2e="browse-video-desc"]',
  '[data-e2e="feed-video-desc"]',
  '[data-e2e="modal-video-desc"]',
  '[data-e2e="slide-video-desc"]',
  '[data-e2e="video-info-detail"]',
  '[data-e2e="detail-video-info"]',
  '[data-e2e="video-info"]',
  '[class*="video-desc"]',
  '[class*="videoDesc"]',
  '[class*="VideoDesc"]',
  '[class*="video-info"] [class*="title"]',
  '[class*="video-info"] [class*="desc"]',
];

const LAYOUT_NOISE =
  /^(关注|已关注|点赞|抢首评|分享|收藏|评论|播放|play|抖音|推荐|直播|全屏|连播|倍速|清屏|静音|展开|收起|查看|\d+(\.\d+)?万?)$/i;

function isDouyinNoiseTitle(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^PC[\s_]*通用配置$/i.test(t)) return true;
  if (/^PC[\s_\d]*[\u4e00-\u9fff]{0,12}配置$/i.test(t)) return true;
  if (/通用配置$/.test(t) && t.length <= 20) return true;
  if (/配置$/.test(t) && t.length <= 18 && !/#/.test(t) && !/@/.test(t)) return true;
  if (/^(默认|实验|测试|线上|灰度).{0,6}配置$/i.test(t)) return true;
  if (/^(Windows|Mac|Android|iOS|Web|PC)$/i.test(t)) return true;
  return false;
}

function scoreTitleCandidate(text: string): number {
  const t = text.trim();
  if (t.length < 2 || t.length > 300) return -100;
  if (isDouyinNoiseTitle(t)) return -100;
  if (LAYOUT_NOISE.test(t)) return -100;
  if (isDouyinPlayTitle(t)) return -100;
  if (/^https?:\/\//i.test(t)) return -100;
  let score = 0;
  if (/[\u4e00-\u9fff]/.test(t)) score += 5;
  if (t.length >= 6 && t.length <= 120) score += 3;
  if (/#\S/.test(t)) score += 1;
  if (/^@\S{1,24}$/.test(t)) score -= 4;
  if (/^\d+[\s\d,.]*$/.test(t)) return -100;
  return score;
}

function pickBestTitleCandidate(candidates: string[]): string | undefined {
  const seen = new Set<string>();
  const scored = candidates
    .map((d) => d.replace(/\s+/g, ' ').trim())
    .filter((d) => d.length > 2 && d.length < 500 && !seen.has(d) && seen.add(d))
    .map((d) => ({ d, score: scoreTitleCandidate(d) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.d;
}

function pickAwemeDesc(candidates: string[]): string | undefined {
  return pickBestTitleCandidate(candidates);
}

function visitAllVideos(
  root: Document | ShadowRoot,
  out: HTMLVideoElement[],
): void {
  root.querySelectorAll('video').forEach((el) => out.push(el));
  root.querySelectorAll('*').forEach((el) => {
    if (el instanceof HTMLElement && el.shadowRoot) visitAllVideos(el.shadowRoot, out);
  });
}

function isElementVisible(el: Element, win: Window): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = win.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width >= 40 && rect.height >= 40;
}

function findTopmostPlayerShell(doc: Document, win: Window, selector: string): Element | null {
  const nodes = [...doc.querySelectorAll(selector)].filter((el) => isElementVisible(el, win));
  if (nodes.length === 0) return null;
  let best: Element | null = null;
  let bestScore = -1;
  for (const el of nodes) {
    const style = win.getComputedStyle(el);
    const z = Number.parseInt(style.zIndex, 10) || 0;
    const rect = el.getBoundingClientRect();
    const score = z * 10_000 + rect.width * rect.height;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/** 弹窗打开时最上层的播放器容器（xgplayer / basePlayerContainer）。 */
export function findDouyinModalScope(doc: Document): Element | null {
  const win = doc.defaultView;
  if (!win) return null;

  const xg = findTopmostPlayerShell(
    doc,
    win,
    'xg-video-container, [class*="xg-video-container"]',
  );
  if (xg) {
    return (
      (xg.closest(
        '[class*="modal"], [class*="Modal"], [role="dialog"], [class*="basePlayerContainer"]',
      ) as Element | null) ?? xg
    );
  }

  const players = findTopmostPlayerShell(doc, win, '[class*="basePlayerContainer"]');
  if (!players) return null;
  return (
    (players.closest('[class*="modal"], [class*="Modal"], [role="dialog"]') as Element | null) ??
    players
  );
}

/** xgplayer 在页面上用 blob: 做 MSE 播放，不能作为投屏直链。 */
export function isDouyinXgBlobVideo(el: HTMLVideoElement): boolean {
  const src = (el.currentSrc || el.src || '').trim();
  if (!src.startsWith('blob:')) return false;
  return Boolean(
    el.closest('xg-video-container, [class*="xg-video-container"], [class*="basePlayerContainer"]'),
  );
}

function findActiveDouyinVideo(doc: Document, pageUrl?: string): HTMLVideoElement | null {
  const win = doc.defaultView;
  if (!win) return null;

  const modalId = pageUrl ? getDouyinModalId(pageUrl) : null;
  const modalScope = modalId ? findDouyinModalScope(doc) : null;

  const videos: HTMLVideoElement[] = [];
  visitAllVideos(doc, videos);

  let best: HTMLVideoElement | null = null;
  let bestScore = -1;

  for (const v of videos) {
    if (modalId && modalScope && !modalScope.contains(v)) continue;
    if (!isElementVisible(v, win)) continue;
    const rect = v.getBoundingClientRect();
    const src = (v.currentSrc || v.src || '').trim();

    let score = 0;
    if (src.startsWith('blob:')) score += 28;
    if (!v.paused && v.readyState >= 2) score += 32;
    else if (!v.paused) score += 12;
    if (rect.top < win.innerHeight * 0.92 && rect.bottom > win.innerHeight * 0.08) score += 18;
    score += Math.min((rect.width * rect.height) / 8000, 24);
    if (modalScope?.contains(v)) score += 45;
    if (v.closest('xg-video-container, [class*="xg-video-container"]')) score += 20;

    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }
  return best;
}

function captionFromElement(el: Element): string | undefined {
  if (!(el instanceof HTMLElement)) return undefined;
  const win = el.ownerDocument.defaultView;
  if (win && !isElementVisible(el, win)) return undefined;

  const aria = el.getAttribute('aria-label')?.trim();
  if (aria && scoreTitleCandidate(aria) > 0) return aria;

  const raw = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!raw) return undefined;

  const lines = raw
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => scoreTitleCandidate(l) > 0);
  if (lines.length === 0) return scoreTitleCandidate(raw) > 0 ? raw : undefined;
  return pickBestTitleCandidate(lines) ?? (scoreTitleCandidate(raw) > 0 ? raw : undefined);
}

function findBasePlayerContainer(
  doc: Document,
  video: HTMLVideoElement | null,
  pageUrl?: string,
): Element | null {
  const modalId = pageUrl ? getDouyinModalId(pageUrl) : null;
  if (modalId) {
    const scope = findDouyinModalScope(doc);
    if (scope?.matches('[class*="basePlayerContainer"]')) return scope;
    const nested = scope?.querySelector('[class*="basePlayerContainer"]');
    if (nested) return nested;
  }

  const containers = doc.querySelectorAll('[class*="basePlayerContainer"]');
  if (containers.length === 0) return null;

  if (video) {
    let innermost: Element | null = null;
    let maxDepth = -1;
    for (const c of containers) {
      if (!c.contains(video)) continue;
      let depth = 0;
      for (let n: Element | null = video; n && n !== c; n = n.parentElement) depth++;
      if (depth > maxDepth) {
        maxDepth = depth;
        innermost = c;
      }
    }
    if (innermost) return innermost;
  }

  const win = doc.defaultView;
  if (win) {
    for (const c of containers) {
      if (isElementVisible(c, win)) return c;
    }
  }
  return containers[0] ?? null;
}

/** 标题在 basePlayerContainer 的直接/嵌套子 div 中。 */
function collectTitlesFromBasePlayerRoot(
  container: Element,
  video: HTMLVideoElement | null,
): string[] {
  const found: string[] = [];

  const harvestDiv = (div: Element) => {
    if (video && (div === video || video.contains(div))) return;
    if (div instanceof HTMLElement) {
      const cls = `${div.className} ${div.getAttribute('data-e2e') ?? ''}`;
      if (/config|setting|abtest|generic|experiment|platform/i.test(cls)) return;
    }
    const t = captionFromElement(div);
    if (t) found.push(t);
  };

  container.querySelectorAll(':scope > div').forEach((child) => {
    if (video && child.contains(video)) {
      child.querySelectorAll('div').forEach((nested) => {
        if (video.contains(nested)) return;
        if (nested.querySelector('video')) return;
        harvestDiv(nested);
      });
      return;
    }
    harvestDiv(child);
    child.querySelectorAll(':scope > div').forEach(harvestDiv);
  });

  return found;
}

function collectTitlesFromBasePlayerContainer(
  doc: Document,
  video: HTMLVideoElement | null,
  pageUrl?: string,
): string[] {
  const container = findBasePlayerContainer(doc, video, pageUrl);
  if (!container) return [];
  return collectTitlesFromBasePlayerRoot(container, video);
}

function extractTitleFromBasePlayerContainer(
  doc: Document,
  video: HTMLVideoElement | null,
  pageUrl?: string,
): string | undefined {
  return pickBestTitleCandidate(collectTitlesFromBasePlayerContainer(doc, video, pageUrl));
}

function collectTitlesInContainer(container: Element, video: HTMLVideoElement): string[] {
  const found: string[] = [];

  if (container.matches('[class*="basePlayerContainer"]')) {
    found.push(...collectTitlesFromBasePlayerRoot(container, video));
  }

  for (const sel of LAYOUT_TITLE_SELECTORS) {
    container.querySelectorAll(sel).forEach((el) => {
      if (el === video || video.contains(el)) return;
      const t = captionFromElement(el);
      if (t) found.push(t);
    });
  }

  container.querySelectorAll('[data-e2e*="desc"], [data-e2e*="title"]').forEach((el) => {
    if (el === video || video.contains(el)) return;
    const e2e = el.getAttribute('data-e2e') || '';
    if (/user|name|avatar|music|comment-btn|share|config|setting|abtest|generic/i.test(e2e)) {
      return;
    }
    const t = captionFromElement(el);
    if (t) found.push(t);
  });

  return found;
}

/** 从当前播放 video 向上遍历父级卡片/滑块，读取描述文案。 */
function extractTitleFromVideoAncestors(video: HTMLVideoElement): string | undefined {
  const candidates: string[] = [];
  let node: Element | null = video;
  let depth = 0;
  const maxDepth = 16;

  while (node && depth < maxDepth) {
    candidates.push(...collectTitlesInContainer(node, video));

    const parentEl: Element | null = node.parentElement;
    if (parentEl) {
      for (const sibling of parentEl.children) {
        if (sibling === node || sibling.contains(video)) continue;
        candidates.push(...collectTitlesInContainer(sibling, video));
      }
    }

    node = parentEl;
    depth++;
  }

  return pickBestTitleCandidate(candidates);
}

/** 在视频上一层级布局中查找作品标题（优先于 document.title / RENDER_DATA）。 */
export function extractDouyinTitleFromLayout(doc: Document = document): string | undefined {
  const host = doc.defaultView?.location.hostname ?? '';
  if (!isDouyinPage(host)) return undefined;
  const pageUrl = doc.defaultView?.location.href ?? '';
  const video = findActiveDouyinVideo(doc, pageUrl);

  const fromPlayer = extractTitleFromBasePlayerContainer(doc, video, pageUrl);
  if (fromPlayer) return fromPlayer;

  if (!video) return undefined;
  return extractTitleFromVideoAncestors(video);
}

function collectUrlsForAweme(value: unknown, targetId: string, found: Set<string>): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) collectUrlsForAweme(item, targetId, found);
    return;
  }
  if (typeof value !== 'object') return;

  const o = value as Record<string, unknown>;
  const selfMatch = [o.aweme_id, o.awemeId, o.item_id, o.itemId, o.id].some(
    (id) => id != null && String(id) === targetId,
  );
  if (selfMatch) extractDouyinUrlsFromJson(o, found);

  for (const v of Object.values(o)) collectUrlsForAweme(v, targetId, found);
}

/** 从 RENDER_DATA 提取指定 modal_id / aweme_id 的可播 CDN 地址。 */
export function extractPlayUrlsForAwemeId(doc: Document, awemeId: string): string[] {
  const found = new Set<string>();
  for (const chunk of collectRenderChunks(doc)) {
    const data = parseRenderJson(chunk);
    if (data) collectUrlsForAweme(data, awemeId, found);
  }
  return [...found];
}

function streamUrlsEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    if (ua.origin !== ub.origin) return false;
    if (ua.pathname === ub.pathname) return true;
    const minLen = Math.min(ua.pathname.length, ub.pathname.length, 48);
    return (
      ua.pathname.slice(0, minLen) === ub.pathname.slice(0, minLen) ||
      a.includes(ub.pathname.slice(0, 40)) ||
      b.includes(ua.pathname.slice(0, 40))
    );
  } catch {
    return a.includes(b.slice(0, 48)) || b.includes(a.slice(0, 48));
  }
}

function videoMatchesModalStreams(url: string, modalUrls: Set<string>): boolean {
  const normalized = normalizeHttpUrl(url);
  if (!normalized) return false;
  for (const mu of modalUrls) {
    if (streamUrlsEquivalent(normalized, mu)) return true;
  }
  return false;
}

function lastResourceIndex(entries: PerformanceEntryList, url: string): number {
  let last = -1;
  for (let i = 0; i < entries.length; i++) {
    const name = entries[i].name;
    if (streamUrlsEquivalent(name, url)) last = i;
  }
  return last;
}

function walkAwemeDesc(
  value: unknown,
  modalId: string | null,
  matched: string[],
  fallback: string[],
): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) walkAwemeDesc(item, modalId, matched, fallback);
    return;
  }
  if (typeof value !== 'object') return;

  const o = value as Record<string, unknown>;
  const ids = [
    o.aweme_id,
    o.awemeId,
    o.item_id,
    o.itemId,
    o.id,
    o.modal_id,
  ]
    .filter((id) => id != null)
    .map((id) => String(id));

  const hasAweme =
    o.aweme_id != null ||
    o.awemeId != null ||
    o.aweme_type != null ||
    o.item_id != null ||
    o.itemId != null ||
    (typeof o.desc === 'string' && o.desc.length > 0);

  const desc =
    (typeof o.desc === 'string' && o.desc.trim()) ||
    (typeof o.share_title === 'string' && o.share_title.trim()) ||
    (hasAweme && typeof o.title === 'string' && o.title.length > 5 ? o.title.trim() : undefined);

  if (desc && !isDouyinNoiseTitle(desc)) {
    if (modalId && ids.some((id) => id === modalId)) matched.push(desc);
    else fallback.push(desc);
  }

  for (const v of Object.values(o)) walkAwemeDesc(v, modalId, matched, fallback);
}

/** 从布局 → RENDER_DATA → 页面标题解析当前作品描述。 */
export function resolveDouyinDisplayTitle(
  pageUrl: string,
  pageTitle?: string,
  doc: Document = document,
): string | undefined {
  const fromLayout = extractDouyinTitleFromLayout(doc);
  if (fromLayout) return fromLayout;

  const fromDoc = pageTitle ? cleanDouyinDocumentTitle(pageTitle) : undefined;
  if (fromDoc && !isDouyinPlayTitle(fromDoc)) return fromDoc;

  let modalId: string | null = null;
  try {
    modalId = new URL(pageUrl, doc.baseURI).searchParams.get('modal_id');
  } catch {
    /* ignore */
  }

  const matched: string[] = [];
  const fallback: string[] = [];
  for (const chunk of collectRenderChunks(doc)) {
    const data = parseRenderJson(chunk);
    if (data) walkAwemeDesc(data, modalId, matched, fallback);
  }

  return (
    pickAwemeDesc(matched) ??
    pickAwemeDesc(fallback) ??
    (fromDoc && !isDouyinPlayTitle(fromDoc) ? fromDoc : undefined)
  );
}

const DOUYIN_SOURCE_PRIORITY: Record<string, number> = {
  'script-json': 0,
  network: 1,
  'video-element': 2,
  'source-tag': 3,
  'iframe-src': 4,
  'page-query': 5,
  'page-link': 6,
};

export interface DouyinRefineVideo {
  url: string;
  title?: string;
  mimeType?: string;
  source: string;
}

function pickBestDouyinPlayVideo<T extends DouyinRefineVideo>(candidates: T[]): T {
  return [...candidates].sort((a, b) => {
    const pa = DOUYIN_SOURCE_PRIORITY[a.source] ?? 99;
    const pb = DOUYIN_SOURCE_PRIORITY[b.source] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.url.length - a.url.length;
  })[0];
}

function getRecentDouyinResourceUrls(doc: Document): string[] {
  const win = doc.defaultView;
  if (!win) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of win.performance.getEntriesByType('resource')) {
    const name = entry.name;
    if (!looksLikeDouyinMediaUrl(name) || !isDouyinActiveStreamUrl(name)) continue;
    const normalized = normalizeHttpUrl(name);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** blob 播放器在播但列表无 http 时，从 Performance / RENDER_DATA 补一条弹窗 CDN。 */
function buildModalPoolFromNetwork<T extends DouyinRefineVideo>(
  videos: T[],
  doc: Document,
  modalId: string,
  modalUrlSet: Set<string>,
): T[] {
  for (const u of extractPlayUrlsForAwemeId(doc, modalId)) modalUrlSet.add(u);

  const fromList = videos.filter(
    (v) => isDouyinActiveStreamUrl(v.url) && videoMatchesModalStreams(v.url, modalUrlSet),
  );
  if (fromList.length > 0) return fromList;

  const perfUrls = getRecentDouyinResourceUrls(doc);
  const perfMatched =
    modalUrlSet.size > 0
      ? perfUrls.filter((u) => videoMatchesModalStreams(u, modalUrlSet))
      : perfUrls;
  const pickUrl = perfMatched[perfMatched.length - 1] ?? perfUrls[perfUrls.length - 1];
  if (!pickUrl) return [];

  const existing = videos.find((v) => streamUrlsEquivalent(v.url, pickUrl));
  if (existing) return [existing];
  return [{ url: pickUrl, source: 'network', title: 'play' } as T];
}

function pickByResourceRecency<T extends DouyinRefineVideo>(
  candidates: T[],
  doc: Document,
): T {
  const win = doc.defaultView;
  if (!win) return pickBestDouyinPlayVideo(candidates);
  const entries = win.performance.getEntriesByType('resource');
  return [...candidates].sort((a, b) => {
    const ia = lastResourceIndex(entries, a.url);
    const ib = lastResourceIndex(entries, b.url);
    if (ib !== ia) return ib - ia;
    const pa = DOUYIN_SOURCE_PRIORITY[a.source] ?? 99;
    const pb = DOUYIN_SOURCE_PRIORITY[b.source] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.url.length - a.url.length;
  })[0];
}

export interface DouyinRefineOptions {
  doc?: Document;
  /** 由页面脚本扫描带入，供 background 合并时使用 */
  modalStreamUrls?: string[];
}

/** 抖音首页/精选流：只保留当前可播 CDN；弹窗页优先 modal_id 对应流。 */
export function refineDouyinFeedVideos<T extends DouyinRefineVideo>(
  videos: T[],
  pageUrl?: string,
  pageTitle?: string,
  options?: DouyinRefineOptions,
): T[] {
  if (!pageUrl || !isDouyinFeedHome(pageUrl)) return videos;

  const modalId = getDouyinModalId(pageUrl);
  const doc = options?.doc;

  const playTitled = videos.filter((v) => isDouyinPlayTitle(v.title));
  const activeStreams = videos.filter((v) => isDouyinActiveStreamUrl(v.url));
  let pool = playTitled.length > 0 ? playTitled : activeStreams;

  if (pool.length === 0 && modalId && doc) {
    const modalUrlSet = new Set(options?.modalStreamUrls ?? []);
    pool = buildModalPoolFromNetwork(videos, doc, modalId, modalUrlSet);
  }
  if (pool.length === 0) return [];

  if (modalId) {
    const modalUrlSet = new Set(options?.modalStreamUrls ?? []);
    if (doc) {
      for (const u of extractPlayUrlsForAwemeId(doc, modalId)) modalUrlSet.add(u);
    }

    if (modalUrlSet.size > 0) {
      const matched = pool.filter((v) => videoMatchesModalStreams(v.url, modalUrlSet));
      if (matched.length > 0) pool = matched;
      else if (doc) pool = buildModalPoolFromNetwork(videos, doc, modalId, modalUrlSet);
    }

    if (pool.length > 1 && doc) {
      pool = [pickByResourceRecency(pool, doc)];
    } else if (pool.length > 1) {
      pool = [pickBestDouyinPlayVideo(pool)];
    }
  } else if (pool.length > 1) {
    pool = doc ? [pickByResourceRecency(pool, doc)] : [pickBestDouyinPlayVideo(pool)];
  } else {
    pool = [pickBestDouyinPlayVideo(pool)];
  }

  if (pool.length === 0) return [];

  const best = pool[0];
  const displayTitle =
    (doc ? resolveDouyinDisplayTitle(pageUrl, pageTitle, doc) : undefined) ??
    (pageTitle ? cleanDouyinDocumentTitle(pageTitle) : undefined) ??
    best.title;
  return [{ ...best, title: displayTitle }];
}

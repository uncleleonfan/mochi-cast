import { scanVideosInFrame } from './scan-in-frame.js';
import type { FrameVideoScanMeta } from './video-scanner.js';
import type { PageVideoHints } from './video-scanner.js';
import type { DetectedVideo, VideoScanDiagnostics } from '../shared/messages.js';

export interface TabVideoScanResult {
  videos: DetectedVideo[];
  pageTitle?: string;
  pageUrl?: string;
  error?: string;
  hints?: PageVideoHints;
  scan?: VideoScanDiagnostics;
}

type FrameScanPayload = TabVideoScanResult & { frameMeta?: FrameVideoScanMeta };

const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
  'view-source:',
];

/** Main-frame scan (MacPlayer iframe src lives here). */
const MAIN_FRAME_TIMEOUT_MS = 2500;
/** All-frames scan — can hang on ad iframes without a cap. */
const ALL_FRAMES_TIMEOUT_MS = 5000;
const MESSAGE_TIMEOUT_MS = 2000;

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return RESTRICTED_PREFIXES.some((p) => url.startsWith(p));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

function buildDiagnostics(
  parts: FrameScanPayload[],
  merged: TabVideoScanResult,
): VideoScanDiagnostics {
  let iframeCount = 0;
  let videoElementCount = 0;
  let blobVideoCount = 0;
  let htmlMediaHits = 0;

  for (const part of parts) {
    const meta = part.frameMeta;
    if (!meta) continue;
    iframeCount += meta.iframeCount;
    videoElementCount += meta.videoElementCount;
    blobVideoCount += meta.blobVideoCount;
    htmlMediaHits += meta.htmlMediaHits;
  }

  if (merged.hints) {
    blobVideoCount = Math.max(blobVideoCount, merged.hints.blobVideoCount);
  }

  const videoCount = merged.videos.length;
  let state: VideoScanDiagnostics['state'] = 'empty';
  if (merged.error === 'restricted_page') state = 'restricted';
  else if (
    merged.error === 'no_content_script' ||
    merged.error === 'no_active_tab' ||
    merged.error === 'scan_timeout'
  ) {
    state = 'error';
  } else if (videoCount > 0) state = 'found';
  else state = 'empty';

  return {
    state,
    videoCount,
    framesScanned: parts.length,
    iframeCount,
    videoElementCount,
    blobVideoCount,
    htmlMediaHits,
    pageUrl: merged.pageUrl,
    error: merged.error,
  };
}

function mergeVideoResults(
  parts: FrameScanPayload[],
  fallback: { pageTitle?: string; pageUrl?: string },
): TabVideoScanResult {
  const byUrl = new Map<string, DetectedVideo>();
  let hints: PageVideoHints | undefined;
  let pageTitle = fallback.pageTitle;
  let pageUrl = fallback.pageUrl;

  for (const part of parts) {
    if (part.pageTitle && part.videos.length > 0) pageTitle = part.pageTitle;
    if (part.pageUrl) pageUrl = part.pageUrl;
    for (const video of part.videos) {
      const existing = byUrl.get(video.url);
      if (!existing || (video.title && !existing.title)) {
        byUrl.set(video.url, video as DetectedVideo);
      }
    }
    if (part.hints) {
      hints = hints
        ? {
            blobVideoCount: hints.blobVideoCount + part.hints.blobVideoCount,
            isBilibili: hints.isBilibili || part.hints.isBilibili,
          }
        : { ...part.hints };
    }
  }

  const merged: TabVideoScanResult = {
    videos: Array.from(byUrl.values()),
    pageTitle,
    pageUrl,
    hints,
  };
  merged.scan = buildDiagnostics(parts, merged);
  return merged;
}

async function runFrameScan(
  tabId: number,
  options: { allFrames: boolean },
): Promise<FrameScanPayload[]> {
  // Main frame: { tabId } only (omit frameIds — [0] breaks on some pages).
  const target: chrome.scripting.InjectionTarget = options.allFrames
    ? { tabId, allFrames: true }
    : { tabId };

  try {
    const results = await chrome.scripting.executeScript({
      target,
      func: scanVideosInFrame,
    });
    return (results ?? [])
      .map((r) => r.result as FrameScanPayload | undefined)
      .filter((r): r is FrameScanPayload => Boolean(r));
  } catch {
    return [];
  }
}

async function scanFramesWithTimeout(
  tabId: number,
  options: { allFrames: boolean; timeoutMs: number },
): Promise<{ parts: FrameScanPayload[]; timedOut: boolean }> {
  const fallback = { parts: [] as FrameScanPayload[], timedOut: true };
  const result = await withTimeout(
    runFrameScan(tabId, options).then((parts) => ({ parts, timedOut: false })),
    options.timeoutMs,
    fallback,
  );
  return result;
}

async function messageMainFrame(tabId: number): Promise<FrameScanPayload | undefined> {
  return withTimeout(
    chrome.tabs
      .sendMessage(tabId, { type: 'SCAN_VIDEOS' })
      .then((r) => r as FrameScanPayload | undefined)
      .catch(() => undefined),
    MESSAGE_TIMEOUT_MS,
    undefined,
  );
}

export async function getVideosFromTab(tabId: number): Promise<TabVideoScanResult> {
  if (tabId == null || !Number.isFinite(tabId)) {
    const empty: TabVideoScanResult = { videos: [], error: 'no_active_tab' };
    empty.scan = buildDiagnostics([], empty);
    return empty;
  }

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    const empty: TabVideoScanResult = { videos: [], error: 'no_active_tab' };
    empty.scan = buildDiagnostics([], empty);
    return empty;
  }
  if (isRestrictedUrl(tab.url)) {
    const empty: TabVideoScanResult = {
      videos: [],
      error: 'restricted_page',
      pageUrl: tab.url,
    };
    empty.scan = buildDiagnostics([], empty);
    return empty;
  }

  const fallback = { pageTitle: tab.title, pageUrl: tab.url };
  let frameParts: FrameScanPayload[] = [];
  let timedOut = false;

  const main = await scanFramesWithTimeout(tabId, {
    allFrames: false,
    timeoutMs: MAIN_FRAME_TIMEOUT_MS,
  });
  frameParts = main.parts;
  timedOut = main.timedOut;

  let merged = mergeVideoResults(frameParts, fallback);
  if (merged.videos.length > 0) {
    return merged;
  }

  const all = await scanFramesWithTimeout(tabId, {
    allFrames: true,
    timeoutMs: ALL_FRAMES_TIMEOUT_MS,
  });
  if (all.parts.length > 0) {
    frameParts = mergeFrameParts(frameParts, all.parts);
    timedOut = timedOut || all.timedOut;
    merged = mergeVideoResults(frameParts, fallback);
    if (merged.videos.length > 0) {
      merged.scan = buildDiagnostics(frameParts, merged);
      return merged;
    }
  } else if (all.timedOut) {
    timedOut = true;
  }

  const fromMessage = await messageMainFrame(tabId);
  if (fromMessage?.videos?.length) {
    return mergeVideoResults([fromMessage], fallback);
  }
  if (fromMessage?.frameMeta) {
    frameParts = mergeFrameParts(frameParts, [fromMessage]);
    merged = mergeVideoResults(frameParts, fallback);
  }

  if (merged.videos.length > 0) {
    merged.scan = buildDiagnostics(frameParts, merged);
    return merged;
  }

  const failed: TabVideoScanResult = {
    videos: [],
    pageTitle: tab.title,
    pageUrl: tab.url,
    error: timedOut ? 'scan_timeout' : frameParts.length > 0 ? undefined : 'no_videos_found',
    hints: merged.hints,
  };
  failed.scan = buildDiagnostics(frameParts, { ...failed, error: failed.error });
  return failed;
}

function mergeFrameParts(
  existing: FrameScanPayload[],
  incoming: FrameScanPayload[],
): FrameScanPayload[] {
  const byUrl = new Set(existing.map((p) => p.pageUrl));
  const out = [...existing];
  for (const part of incoming) {
    if (!byUrl.has(part.pageUrl)) {
      out.push(part);
      byUrl.add(part.pageUrl);
    } else {
      const idx = out.findIndex((p) => p.pageUrl === part.pageUrl);
      if (idx >= 0 && part.videos.length > out[idx].videos.length) {
        out[idx] = part;
      }
    }
  }
  return out;
}

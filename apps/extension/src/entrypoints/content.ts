import type { DetectedVideo } from '../shared/messages.js';

const MEDIA_URL_PATTERN =
  /\.(mp4|webm|mkv|m3u8|mp3|m4v|mov)(\?|$)|m3u8|video\/|application\/vnd\.apple\.mpegurl/i;

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    const videos = new Map<string, DetectedVideo>();

    function addVideo(video: DetectedVideo) {
      if (!isCastableUrl(video.url)) return;
      videos.set(video.url, video);
    }

    function scanVideoElements() {
      document.querySelectorAll('video').forEach((el, index) => {
        const src = el.currentSrc || el.src;
        if (src) {
          addVideo({
            url: src,
            title: document.title || `Video ${index + 1}`,
            source: 'video-element',
          });
        }
        el.querySelectorAll('source').forEach((source) => {
          if (source.src) {
            addVideo({
              url: source.src,
              title: document.title,
              mimeType: source.type || undefined,
              source: 'source-tag',
            });
          }
        });
      });

      document.querySelectorAll('a[href]').forEach((anchor) => {
        const href = (anchor as HTMLAnchorElement).href;
        if (MEDIA_URL_PATTERN.test(href)) {
          addVideo({
            url: href,
            title: anchor.textContent?.trim() || document.title,
            source: 'page-link',
          });
        }
      });
    }

    scanVideoElements();

    const observer = new MutationObserver(() => scanVideoElements());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      tryCaptureFromRequest(args[0]);
      return response;
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      tryCaptureFromRequest(url);
      return originalOpen.call(this, method, url, async ?? true, username, password);
    };

    function tryCaptureFromRequest(input: RequestInfo | URL) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (isCastableUrl(url) && MEDIA_URL_PATTERN.test(url)) {
        addVideo({ url, title: document.title, source: 'network' });
      }
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SCAN_VIDEOS') {
        scanVideoElements();
        sendResponse({
          videos: Array.from(videos.values()),
          pageTitle: document.title,
        });
      }
      return false;
    });
  },
});

function isCastableUrl(url: string): boolean {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

import { createVideoScanner } from '../lib/video-scanner.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchOriginAsFallback: true,
  runAt: 'document_idle',
  main() {
    const scanner = createVideoScanner();

    (window as unknown as { __mochiCastScanner?: typeof scanner }).__mochiCastScanner = scanner;

    scanner.scan();

    const observer = new MutationObserver(() => scanner.scan());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'href', 'data-xgplayerid'],
    });

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      scanner.captureFromRequest(args[0]);
      void scanner.captureFromFetchResponse?.(args[0], response.clone());
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
      scanner.captureFromRequest(url);
      return originalOpen.call(this, method, url, async ?? true, username, password);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      this.addEventListener('load', () => scanner.captureFromXhr?.(this));
      return originalSend.call(this, body);
    };

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SCAN_VIDEOS') {
        scanner.scan();
        sendResponse({
          videos: scanner.getVideos(),
          pageTitle: document.title,
          pageUrl: location.href,
          hints: scanner.getHints(),
          frameMeta: scanner.getFrameMeta?.(),
        });
      }
      return false;
    });
  },
});

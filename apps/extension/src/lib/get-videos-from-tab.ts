import { scanVideosInFrame } from './scan-in-frame.js';
import type { PageVideoHints } from './video-scanner.js';
import type { DetectedVideo } from '../shared/messages.js';

export interface TabVideoScanResult {
  videos: DetectedVideo[];
  pageTitle?: string;
  pageUrl?: string;
  error?: string;
  hints?: PageVideoHints;
}

const RESTRICTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'devtools://',
  'view-source:',
];

function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return RESTRICTED_PREFIXES.some((p) => url.startsWith(p));
}

export async function getVideosFromTab(tabId: number): Promise<TabVideoScanResult> {
  const tab = await chrome.tabs.get(tabId);
  if (isRestrictedUrl(tab.url)) {
    return {
      videos: [],
      error: 'restricted_page',
      pageUrl: tab.url,
    };
  }

  try {
    const response = (await chrome.tabs.sendMessage(tabId, { type: 'SCAN_VIDEOS' })) as
      | TabVideoScanResult
      | undefined;
    if (response?.videos) {
      return {
        videos: response.videos,
        pageTitle: response.pageTitle,
        pageUrl: response.pageUrl ?? tab.url,
      };
    }
  } catch {
    /* content script not ready */
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scanVideosInFrame,
    });
    const data = result?.result as TabVideoScanResult | undefined;
    if (data?.videos?.length) {
      return {
        videos: data.videos as DetectedVideo[],
        pageTitle: data.pageTitle,
        pageUrl: data.pageUrl ?? tab.url,
      };
    }
  } catch {
    /* executeScript failed */
  }

  try {
    const manifest = chrome.runtime.getManifest();
    const contentScript = manifest.content_scripts?.[0];
    const js = contentScript?.js;
    if (js?.length) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: js,
      });
      const response = (await chrome.tabs.sendMessage(tabId, { type: 'SCAN_VIDEOS' })) as
        | TabVideoScanResult
        | undefined;
      if (response?.videos) {
        return {
          videos: response.videos,
          pageTitle: response.pageTitle,
          pageUrl: response.pageUrl ?? tab.url,
        };
      }
    }
  } catch {
    /* injection failed */
  }

  return {
    videos: [],
    pageTitle: tab.title,
    pageUrl: tab.url,
    error: 'no_content_script',
  };
}

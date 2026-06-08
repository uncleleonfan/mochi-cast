import type { SiteContent } from './types';

export const content: SiteContent = {
  meta: {
    title: 'Mochi Cast - Open Source DLNA Casting Extension',
    description:
      'Cast web videos from your browser to Xiaomi, TCL, Sony, and other DLNA smart TVs on your local network.',
  },
  seo: {
    siteName: 'Mochi Cast',
    keywords: [
      'Mochi Cast',
      'DLNA cast',
      'browser cast to TV',
      'Chrome casting extension',
      'cast web video to smart TV',
      'Xiaomi TV cast',
      'DLNA renderer',
      'screen cast extension',
    ],
    pages: {
      home: {
        title: 'Mochi Cast - Open Source DLNA Browser Extension | Cast Web Video to TV',
        description:
          'Mochi Cast is a free, open-source Chrome extension that casts web videos to DLNA smart TVs (Xiaomi, TCL, Sony, LG) on your Wi-Fi—no TV app required.',
      },
      download: {
        title: 'Download Mochi Cast - Chrome & Edge DLNA Casting Extension',
        description:
          'Download the Mochi Cast .zip for Chrome/Edge sideload install, or optionally use the Chrome Web Store.',
      },
      guide: {
        title: 'User Guide - Mochi Cast DLNA Setup & FAQ',
        description:
          'Learn how to cast with Mochi Cast: same Wi-Fi, enable DLNA on your TV, detect video, and start casting. TV setup tips and troubleshooting FAQ.',
      },
      compatibility: {
        title: 'Device Compatibility - DLNA TVs Supported by Mochi Cast',
        description:
          'Community-tested compatibility for Xiaomi, TCL, Sony, LG, and other DLNA smart TVs with Mochi Cast, plus known limitations.',
      },
      privacy: {
        title: 'Privacy Policy - Mochi Cast Extension & Website',
        description:
          'Mochi Cast does not collect personal data; settings stay local. Extension permissions, website analytics, and support at support@mashutouping.com.',
      },
    },
  },
  nav: {
    home: 'Home',
    download: 'Download',
    guide: 'Guide',
    compatibility: 'Compatibility',
    privacy: 'Privacy',
    github: 'GitHub',
  },
  hero: {
    title: 'Mochi Cast',
    subtitle: '麻薯投屏',
    description:
      'An open-source browser extension that casts web videos to your smart TV over Wi-Fi — supporting Xiaomi, TCL, Sony, LG, and other DLNA renderers.',
    downloadZip: 'Download (ZIP)',
    installGuide: 'Install guide',
    chromeStore: 'Chrome Web Store (optional)',
    chromeStoreBefore: 'Or install from the',
    chromeStoreAfter: 'if available in your region.',
    github: 'View on GitHub',
  },
  features: {
    title: 'Features',
    items: [
      {
        title: 'DLNA Casting',
        description: 'Push direct-link videos to LAN TVs via UPnP/DLNA — no TV app required.',
      },
      {
        title: 'Device Discovery',
        description: 'Subnet scan plus manual IP entry for home networks.',
      },
      {
        title: 'Video Detection',
        description: 'Detects video elements and media URLs on the current page.',
      },
      {
        title: 'Open & Private',
        description: 'MIT licensed. All data stays local in your browser.',
      },
    ],
  },
  steps: {
    title: 'Get Started in 3 Steps',
    items: [
      { title: 'Same Wi-Fi', description: 'Connect PC and TV to the same network' },
      { title: 'Enable DLNA', description: 'Turn on casting / DLNA on your TV' },
      { title: 'Cast', description: 'Pick a device and video in the extension popup' },
    ],
  },
  brands: {
    title: 'Supported Brands',
    items: ['Xiaomi', 'TCL', 'Hisense', 'Sony', 'LG', 'Samsung'],
  },
  footer: {
    tagline: 'Open-source DLNA browser casting',
    license: 'MIT License',
  },
  download: {
    title: 'Download & Install',
    description:
      'Download the ZIP package and load the unpacked extension in Chrome or Edge. The Chrome Web Store is an optional alternative.',
    zipSectionTitle: 'ZIP package',
    zipSectionBadge: 'Recommended',
    zipButton: 'Download v1.0.1 (ZIP)',
    releaseLink: 'View Release Notes',
    zipNote:
      'Works with Chrome, Edge, and other Chromium browsers. Extract the zip, open chrome://extensions, enable Developer mode, then Load unpacked.',
    chromeSectionTitle: 'Chrome Web Store',
    chromeSectionDescription:
      'One-click install with automatic updates if you can access the Chrome Web Store in your region.',
    chromeStoreButton: 'Install from Chrome Web Store',
    requirements: 'Requirements',
    reqItems: [
      'Google Chrome 120+ or Microsoft Edge 120+',
      'PC and TV on the same Wi-Fi',
      'TV with DLNA Media Renderer support',
    ],
    stepsTitle: 'Installation',
    steps: [
      'Download mochi-cast-1.0.1-chrome.zip and extract it',
      'Open Chrome and go to chrome://extensions',
      'Enable Developer mode (top right)',
      'Click Load unpacked and select the extracted folder',
    ],
  },
  guide: {
    title: 'User Guide',
    quickStartTitle: 'Quick Start',
    quickStart: [
      'Connect PC and TV to the same Wi-Fi',
      'Enable casting / DLNA on your TV (see TV setup below)',
      'Open a web page with video and start playback',
      'Open Mochi Cast → scan or add TV IP → select video → cast',
    ],
    tvSetupTitle: 'TV Setup',
    tvSetups: [
      {
        brand: 'Xiaomi TV',
        steps: [
          'Settings → Connection → Wireless display → On',
          'Settings → Network → note the IP address',
          'Use Add IP in the extension if scan fails',
        ],
      },
      {
        brand: 'TCL TV',
        steps: [
          'Settings → Network → Multi-screen / DLNA → On',
          'Scan or manually add the TV IP in the extension',
        ],
      },
    ],
    formatsTitle: 'Supported Formats',
    formats: [
      { type: 'MP4 direct (H.264)', support: 'Recommended', ok: true },
      { type: 'WebM', support: 'TV dependent', ok: false },
      { type: 'HLS (m3u8)', support: 'If TV supports natively', ok: false },
      { type: 'DRM (Netflix, etc.)', support: 'Not supported', ok: false },
    ],
    faqTitle: 'FAQ',
    faq: [
      {
        q: 'No devices found?',
        a: 'Ensure same Wi-Fi and DLNA enabled on TV. Try manual IP entry.',
      },
      {
        q: 'No video detected?',
        a: 'Start playing the video on the page first, then refresh the extension popup.',
      },
      {
        q: 'Cast failed?',
        a: 'The video may be DRM-protected or not a direct HTTP(S) URL the TV can fetch.',
      },
    ],
  },
  compatibility: {
    title: 'Device Compatibility',
    description:
      'Community-reported compatibility status. Submit test results via GitHub Issues.',
    legendTitle: 'Legend',
    legend: [
      { icon: '✅', label: 'Verified' },
      { icon: '⚠️', label: 'Partial' },
      { icon: '❌', label: 'Not supported' },
      { icon: '🧪', label: 'Needs verification' },
    ],
    domesticTitle: 'China Brands',
    domesticHeaders: ['Brand', 'Model', 'MP4', 'HLS', 'Discovery', 'Status'],
    domesticRows: [
      ['Xiaomi', 'Mi TV', '🧪', '🧪', 'Scan / Manual IP', '🧪'],
      ['Xiaomi', 'Mi Box', '🧪', '🧪', 'Manual IP', '🧪'],
      ['TCL', 'Smart TV', '🧪', '🧪', 'Scan / Manual IP', '🧪'],
      ['Hisense', 'ULED', '🧪', '🧪', 'Manual IP', '🧪'],
      ['Skyworth', 'Coocaa', '🧪', '🧪', 'Manual IP', '🧪'],
    ],
    overseasTitle: 'International',
    overseasHeaders: ['Brand', 'Model', 'MP4', 'HLS', 'Status'],
    overseasRows: [
      ['Sony', 'Bravia', '🧪', '🧪', '🧪'],
      ['LG', 'webOS TV', '🧪', '🧪', '🧪'],
      ['Samsung', 'Smart TV', '🧪', '⚠️', '🧪'],
    ],
    contribute: 'Submit compatibility report',
    limitsTitle: 'Known Limitations',
    limits: [
      'DRM content (Netflix, Disney+, etc.) cannot be cast',
      'Authenticated HLS streams the TV cannot fetch directly',
      'blob: URLs are not supported — need direct HTTP(S) links',
      'MP4/H.264 works best',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: 2026-06-02',
    summaryTitle: 'Summary',
    summary:
      'Mochi Cast does not collect, transmit, or sell personal data. Settings and device info are stored locally via chrome.storage.local.',
    accessTitle: 'Data We Access',
    access: [
      { label: 'Page content', text: 'Video URL detection on the current tab when you open the popup.' },
      { label: 'Local network', text: 'Discover and control DLNA devices on your Wi-Fi.' },
      { label: 'Storage', text: 'Save preferences and last-used TV device.' },
    ],
    notCollectTitle: 'We Do NOT Collect',
    notCollect: ['No analytics in the extension', 'No browsing history uploads', 'No third-party sharing'],
    websiteTitle: 'Website (this site)',
    websiteAnalytics:
      'This marketing site uses Google Analytics 4 to collect anonymous usage data (page views, approximate region, device type) to understand how the site is used. Google may use cookies; see Google’s Privacy Policy. The browser extension itself does not use Google Analytics.',
    permissionsTitle: 'Permissions',
    permissions: [
      '<all_urls> — Required to sniff video URLs and send DLNA SOAP to local devices.',
    ],
    contactTitle: 'Contact',
    contact:
      'For extension support, privacy questions, or Chrome Web Store inquiries, email us at:',
    supportEmailLabel: 'Support email',
    contactIssuesBefore: 'You can also report bugs on',
    contactIssuesAfter: '.',
  },
};

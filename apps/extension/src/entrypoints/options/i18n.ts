export const OPTIONS_STRINGS = {
  zh: {
    pageTitle: '麻薯投屏设置',
    general: '通用',
    language: '语言',
    autoSelectLastDevice: '自动选择上次使用的电视',
    discoveryTimeout: '设备发现超时 (ms)',
    subnetPrefix: '局域网网段（可选，优先扫描）',
    subnetHint:
      '自动扫描在 Mac 上可能猜不到网段。若扫描不到电视，请填写路由器网段前三段（与电视 IP 一致），或继续用手动添加 IP。',
    advanced: '高级',
    debug: '启用调试日志（扫描 / 投屏过程会写入下方日志）',
    debugHint:
      '也可在 chrome://extensions → 麻薯投屏 →「Service Worker」→ Console 查看实时日志。',
    refreshLogs: '刷新日志',
    clearLogs: '清空日志',
    copyLogs: '复制日志',
    debugLogPlaceholder: '（开启调试后执行一次扫描，再点「刷新日志」）',
    debugLogEmpty: '（暂无日志。请保存「启用调试」后，在 Popup 点「扫描」，再刷新。）',
    debugLogCleared: '（已清空）',
    about: '关于',
    aboutVersion: '麻薯投屏 v0.1.0 — 开源 DLNA 浏览器投屏扩展',
    github: 'GitHub 仓库',
    legal: '请仅投屏您有权观看的内容。本扩展不提供 DRM 绕过功能。',
    save: '保存设置',
    saved: '已保存',
    logsCopied: '日志已复制',
    loadLogsFailed: '加载日志失败',
  },
  en: {
    pageTitle: 'Mochi Cast Settings',
    general: 'General',
    language: 'Language',
    autoSelectLastDevice: 'Auto-select last used TV',
    discoveryTimeout: 'Discovery timeout (ms)',
    subnetPrefix: 'Subnet prefix (optional, scanned first)',
    subnetHint:
      'Auto-scan may guess the wrong subnet on Mac. Enter the first three octets of your router subnet (same as the TV IP), or keep adding the TV IP manually.',
    advanced: 'Advanced',
    debug: 'Enable debug logs (scan / cast steps are recorded below)',
    debugHint:
      'You can also open chrome://extensions → Mochi Cast → Service Worker → Console for live logs.',
    refreshLogs: 'Refresh logs',
    clearLogs: 'Clear logs',
    copyLogs: 'Copy logs',
    debugLogPlaceholder: '(Enable debug, run a scan once, then click Refresh logs)',
    debugLogEmpty: '(No logs yet. Save with debug enabled, scan in the popup, then refresh.)',
    debugLogCleared: '(Cleared)',
    about: 'About',
    aboutVersion: 'Mochi Cast v0.1.0 — open-source DLNA casting extension',
    github: 'GitHub repository',
    legal: 'Cast only content you have the right to watch. This extension does not bypass DRM.',
    save: 'Save settings',
    saved: 'Saved',
    logsCopied: 'Logs copied',
    loadLogsFailed: 'Failed to load logs',
  },
} as const;

export type OptionsLang = keyof typeof OPTIONS_STRINGS;

export function optionsT(lang: OptionsLang, key: keyof (typeof OPTIONS_STRINGS)['zh']): string {
  return OPTIONS_STRINGS[lang][key];
}

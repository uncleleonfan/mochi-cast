import type { SiteContent } from './types';

export const content: SiteContent = {
  meta: {
    title: '麻薯投屏 - 开源浏览器 DLNA 投屏扩展',
    description:
      '麻薯投屏是一款开源浏览器扩展，将网页视频一键投送到小米、TCL、Sony 等 DLNA 智能电视。',
  },
  nav: {
    home: '首页',
    download: '下载',
    guide: '指南',
    compatibility: '兼容性',
    privacy: '隐私',
    github: 'GitHub',
  },
  hero: {
    title: '麻薯投屏',
    subtitle: 'Mochi Cast',
    description:
      '开源浏览器扩展，让你在同一 Wi-Fi 下将网页视频一键投送到客厅智能电视——支持小米、TCL、Sony、LG 等 DLNA 电视。',
    download: '下载扩展',
    github: '查看 GitHub',
  },
  features: {
    title: '核心特性',
    items: [
      {
        title: 'DLNA 投屏',
        description: '通过 UPnP/DLNA 将可直链视频推送到局域网电视，无需电视端 App。',
      },
      {
        title: '设备发现',
        description: '子网扫描 + 手动 IP 添加，适配国内常见家用网络环境。',
      },
      {
        title: '视频嗅探',
        description: '自动检测页面 video 元素与媒体链接，支持多视频选择。',
      },
      {
        title: '开源隐私',
        description: 'MIT 开源，数据仅存本地，不上传浏览历史。',
      },
    ],
  },
  steps: {
    title: '三步开始投屏',
    items: [
      { title: '同一 Wi-Fi', description: '电脑与电视连接同一无线网络' },
      { title: '开启 DLNA', description: '在电视设置中打开无线投屏 / DLNA' },
      { title: '选择投屏', description: '打开扩展，选择电视与视频即可播放' },
    ],
  },
  brands: {
    title: '支持品牌',
    items: ['小米', 'TCL', '海信', 'Sony', 'LG', 'Samsung'],
  },
  footer: {
    tagline: '开源 DLNA 浏览器投屏扩展',
    license: 'MIT License',
  },
  download: {
    title: '下载安装',
    description: '从 GitHub Release 下载最新版扩展包，或从源码构建。',
    zipButton: '下载 v1.0.0 (ZIP)',
    releaseLink: '查看 Release 说明',
    storeNote: 'Chrome Web Store 版本即将上架',
    requirements: '系统要求',
    reqItems: ['Google Chrome 120+ 或 Microsoft Edge 120+', '电脑与电视同一 Wi-Fi', '电视支持 DLNA Media Renderer'],
    stepsTitle: '安装步骤',
    steps: [
      '下载 mochi-cast-1.0.0-chrome.zip 并解压到文件夹',
      '打开 Chrome，访问 chrome://extensions',
      '开启右上角「开发者模式」',
      '点击「加载已解压的扩展程序」，选择解压后的文件夹',
    ],
  },
  guide: {
    title: '使用指南',
    quickStartTitle: '快速开始',
    quickStart: [
      '电脑与电视连接同一 Wi-Fi',
      '在电视上开启无线投屏 / DLNA（见下方电视设置）',
      '在浏览器中打开含视频的网页并开始播放',
      '点击麻薯投屏图标 → 扫描或添加电视 IP → 选择视频 → 开始投屏',
    ],
    tvSetupTitle: '电视设置',
    tvSetups: [
      {
        brand: '小米电视',
        steps: [
          '设置 → 连接 → 无线投屏 → 开启',
          '设置 → 网络 → 网络信息 → 记下 IP 地址',
          '若扫描未发现，在扩展中使用「添加 IP」',
        ],
      },
      {
        brand: 'TCL 电视',
        steps: [
          '设置 → 网络 → 多屏互动 / DLNA → 开启',
          '在扩展中扫描或手动添加电视 IP',
        ],
      },
    ],
    formatsTitle: '支持的视频格式',
    formats: [
      { type: 'MP4 直链 (H.264)', support: '推荐', ok: true },
      { type: 'WebM', support: '视电视而定', ok: false },
      { type: 'HLS (m3u8)', support: '电视需原生支持', ok: false },
      { type: 'DRM (Netflix 等)', support: '不支持', ok: false },
    ],
    faqTitle: '常见问题',
    faq: [
      {
        q: '未发现设备？',
        a: '请确认电脑与电视在同一 Wi-Fi，并在电视设置中开启无线投屏或 DLNA。也可手动输入电视 IP。',
      },
      {
        q: '未检测到视频？',
        a: '请先在网页中点击播放视频，或全屏播放后再打开扩展刷新。',
      },
      {
        q: '投屏失败？',
        a: '该视频可能受版权保护或需要特殊格式。v1 仅支持电视可直接访问的 HTTP(S) 直链。',
      },
    ],
  },
  compatibility: {
    title: '设备兼容性',
    description:
      '以下列表记录各品牌电视的社区测试状态。欢迎通过 GitHub Issues 提交你的测试结果。',
    legendTitle: '图例',
    legend: [
      { icon: '✅', label: '已验证可用' },
      { icon: '⚠️', label: '部分场景可用' },
      { icon: '❌', label: '不可用' },
      { icon: '🧪', label: '待社区验证' },
    ],
    domesticTitle: '国内品牌',
    domesticHeaders: ['品牌', '型号', 'MP4', 'HLS', '发现方式', '状态'],
    domesticRows: [
      ['小米', 'Mi TV 系列', '🧪', '🧪', '扫描 / 手动 IP', '🧪'],
      ['小米', 'Mi Box', '🧪', '🧪', '手动 IP', '🧪'],
      ['TCL', '智能电视', '🧪', '🧪', '扫描 / 手动 IP', '🧪'],
      ['海信', 'ULED 系列', '🧪', '🧪', '手动 IP', '🧪'],
      ['创维', '酷开系统', '🧪', '🧪', '手动 IP', '🧪'],
    ],
    overseasTitle: '海外品牌',
    overseasHeaders: ['品牌', '型号', 'MP4', 'HLS', '状态'],
    overseasRows: [
      ['Sony', 'Bravia', '🧪', '🧪', '🧪'],
      ['LG', 'webOS TV', '🧪', '🧪', '🧪'],
      ['Samsung', 'Smart TV', '🧪', '⚠️', '🧪'],
    ],
    contribute: '提交兼容性测试结果',
    limitsTitle: '已知限制',
    limits: [
      'DRM 内容（Netflix、Disney+ 等）无法投屏',
      '需 Cookie 鉴权的 HLS 电视无法直接拉流',
      'blob: URL 无法投屏，需可直链访问的 HTTP(S) URL',
      'MP4/H.264 兼容性最好',
    ],
  },
  privacy: {
    title: '隐私政策',
    updated: '最后更新：2026-06-02',
    summaryTitle: '摘要',
    summary:
      '麻薯投屏不收集、传输或出售任何个人数据。所有设置与设备信息均通过 chrome.storage.local 保存在你的浏览器本地。',
    accessTitle: '我们访问的数据',
    access: [
      { label: '页面内容', text: '仅在你打开扩展弹窗时，检测当前标签页的视频 URL。' },
      { label: '局域网', text: '用于发现并控制同一 Wi-Fi 下的 DLNA 设备。' },
      { label: '本地存储', text: '保存你的偏好与上次使用的电视设备。' },
    ],
    notCollectTitle: '我们不收集',
    notCollect: ['扩展内无分析或追踪', '不上传浏览历史', '不与第三方共享数据'],
    websiteTitle: '官网（本网站）',
    websiteAnalytics:
      '本营销网站使用 Google Analytics 4 统计匿名访问数据（如页面浏览、大致地区、设备类型），用于了解网站使用情况。Google 可能使用 Cookie；详见 Google 隐私政策。浏览器扩展本身不使用 Google Analytics。',
    permissionsTitle: '权限说明',
    permissions: [
      '<all_urls> — 用于嗅探视频 URL 并向局域网设备发送 DLNA SOAP 请求。',
    ],
    contactTitle: '联系我们',
    contact: '如有问题请通过 GitHub Issues 反馈。',
  },
};

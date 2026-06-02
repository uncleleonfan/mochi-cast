import type { DlnaDevice } from '@mochi-cast/dlna-core';
import { isCastableUrl, normalizeHttpUrl } from '../../lib/video-scanner.js';
import { buildVideoTitle, episodeLabelFromUrl } from '../../lib/video-title.js';
import type { AppSettings, DetectedVideo, VideoScanDiagnostics } from '../../shared/messages.js';

const STRINGS = {
  zh: {
    title: '麻薯投屏',
    devices: '电视设备',
    scan: '扫描',
    selectDevice: '选择设备…',
    addIp: '添加 IP',
    deviceHint:
      '自动扫描可能找不到电视，可手动添加 IP',
    videos: '检测到的视频',
    videoHint: '请先在网页中播放视频，再点 ↻ 刷新（会扫描 iframe 内播放器）；或下方粘贴 m3u8/MP4 直链',
    addVideoUrl: '添加链接',
    videoUrlAdded: '已添加视频链接',
    videoUrlInvalid: '请输入可访问的 http(s) 视频直链（不支持 blob/YouTube）',
    videoScanRestricted: '无法在此页面检测视频，请打开视频网页或粘贴直链',
    videoScanEmpty: '未检测到视频链接',
    videoScanning: '检测中…',
    videoScanFound: '已找到 {n}',
    videoScanEmptyBadge: '未找到',
    videoScanRestrictedBadge: '不可检测',
    videoScanErrorBadge: '检测失败',
    videoScanTimeout: '检测超时',
    videoScanTimeoutHint: '页面 iframe 过多或较慢，请用下方粘贴 m3u8/MP4 直链',
    videoBlobBilibili:
      'B 站播放器使用 blob 地址，电视无法直接拉流。请播放后点 ↻；若仍无列表，请用下方粘贴 bilibili 返回的 http 直链（或换 MP4 测试页）',
    videoBlobOnly:
      '页面视频为 blob 本地地址，无法投屏。请使用下方「添加链接」粘贴 http(s) MP4 直链',
    cast: '开始投屏',
    settings: '设置',
    scanning: '正在扫描局域网…',
    casting: '投屏中…',
    castOk: '已开始投屏',
    castFail: '投屏失败',
    noVideos: '未检测到可投屏视频',
    deviceAdded: '已添加设备',
    deviceNotFound: '未在该 IP 找到 DLNA 设备',
    scanDoneNoDevices:
      '未发现电视。请用下方「添加 IP」输入电视 IP，或在设置中开启调试后查看控制台',
    reconnecting: '正在连接上次使用的电视…',
    connected: '已连接',
    lastDeviceOffline: '上次电视暂不可用，已保留在列表中',
  },
  en: {
    title: 'Mochi Cast',
    devices: 'TV Devices',
    scan: 'Scan',
    selectDevice: 'Select device…',
    addIp: 'Add IP',
    deviceHint:
      'Auto-scan may miss your TV (no SSDP in Chrome). Set subnet in Settings or add IP below',
    videos: 'Detected Videos',
    videoHint: 'Play the video, click ↻ refresh (scans iframes), or paste m3u8/MP4 below',
    addVideoUrl: 'Add URL',
    videoUrlAdded: 'Video URL added',
    videoUrlInvalid: 'Enter an http(s) direct video URL (no blob/YouTube)',
    videoScanRestricted: 'Cannot scan this page — open a normal web page or paste a URL',
    videoScanEmpty: 'No URL found. If the player is in an iframe, play then refresh, or paste m3u8/MP4',
    videoScanning: 'Scanning…',
    videoScanFound: 'Found {n}',
    videoScanEmptyBadge: 'Not found',
    videoScanRestrictedBadge: 'Blocked',
    videoScanErrorBadge: 'Scan failed',
    videoScanTimeout: 'Timed out',
    videoScanTimeoutHint: 'Too many/slow iframes — paste m3u8/MP4 URL below',
    videoBlobBilibili:
      'Bilibili uses blob URLs in the player. Play the video and refresh; if still empty, paste an http direct URL below (or use an MP4 test page)',
    videoBlobOnly:
      'Video uses a blob URL (not castable). Paste an http(s) MP4 direct link below',
    cast: 'Start Casting',
    settings: 'Settings',
    scanning: 'Scanning local network…',
    casting: 'Casting…',
    castOk: 'Casting started',
    castFail: 'Cast failed',
    noVideos: 'No castable video found',
    deviceAdded: 'Device added',
    deviceNotFound: 'No DLNA device at this IP',
    scanDoneNoDevices:
      'No TV found. Add your TV IP above.',
    reconnecting: 'Reconnecting to last TV…',
    connected: 'Connected',
    lastDeviceOffline: 'Last TV is offline; still listed for retry',
  },
} as const;

interface MessageResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

let settings: AppSettings;
let devices: DlnaDevice[] = [];
let videos: DetectedVideo[] = [];
let selectedDeviceId = '';
let selectedVideoUrl = '';
/** IP of last-used TV — used when reconnect changes device.id (location URL). */
let lastDeviceIpHint = '';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const VIDEO_SCAN_POPUP_TIMEOUT_MS = 12_000;

type VideoScanResponse = {
  videos: DetectedVideo[];
  pageTitle?: string;
  pageUrl?: string;
  error?: string;
  hints?: { blobVideoCount: number; isBilibili: boolean };
  scan?: VideoScanDiagnostics;
};

async function queryActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

async function fetchVideosWithTimeout(): Promise<VideoScanResponse> {
  const tabId = await queryActiveTabId();
  return Promise.race([
    sendMessage<VideoScanResponse>('GET_VIDEOS', tabId != null ? { tabId } : undefined),
    new Promise<VideoScanResponse>((_, reject) => {
      setTimeout(() => reject(new Error('scan_timeout')), VIDEO_SCAN_POPUP_TIMEOUT_MS);
    }),
  ]);
}

function applyVideoScanResult(videoRes: VideoScanResponse) {
  videos = videoRes.videos;
  if (videoRes.pageTitle) $('page-title').textContent = videoRes.pageTitle;
  renderVideos();
  setVideoScanStatus(
    videoRes.scan ?? {
      state: videos.length > 0 ? 'found' : 'empty',
      videoCount: videos.length,
      framesScanned: 0,
      iframeCount: 0,
      videoElementCount: 0,
      blobVideoCount: videoRes.hints?.blobVideoCount ?? 0,
      htmlMediaHits: 0,
      pageUrl: videoRes.pageUrl,
      error: videoRes.error,
    },
  );
  const hint = $('video-hint');
  if (videos.length === 0) {
    hint.classList.remove('hidden');
    hint.textContent = videoHintForScan(videoRes.error, videoRes.hints);
  } else {
    hint.classList.add('hidden');
  }
}

function applyVideoScanError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const isTimeout = message === 'scan_timeout';
  setVideoScanStatus({
    state: 'error',
    videoCount: 0,
    framesScanned: 0,
    iframeCount: 0,
    videoElementCount: 0,
    blobVideoCount: 0,
    htmlMediaHits: 0,
    error: message,
  });
  const hint = $('video-hint');
  hint.classList.remove('hidden');
  hint.textContent = isTimeout ? t('videoScanTimeoutHint') : message;
}

async function sendMessage<T>(type: string, payload?: unknown): Promise<T> {
  const response = (await chrome.runtime.sendMessage({ type, payload })) as MessageResult<T>;
  if (!response.ok) throw new Error(response.error ?? 'Unknown error');
  return response.data as T;
}

function t(key: keyof (typeof STRINGS)['zh']): string {
  const lang = settings?.language === 'en' ? 'en' : 'zh';
  return STRINGS[lang][key];
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as keyof (typeof STRINGS)['zh'];
    if (key && el.textContent !== undefined) el.textContent = t(key);
  });
}

function setStatus(text: string, isError = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function setVideoScanStatus(scan?: VideoScanDiagnostics, scanning = false) {
  const el = $('video-scan-status');
  if (scanning) {
    el.textContent = t('videoScanning');
    el.className = 'scan-badge scanning';
    el.title = t('videoScanning');
    return;
  }
  if (!scan) {
    el.textContent = '—';
    el.className = 'scan-badge';
    el.title = '';
    return;
  }

  el.title = '';

  switch (scan.state) {
    case 'found':
      el.textContent = t('videoScanFound').replace('{n}', String(scan.videoCount));
      el.className = 'scan-badge found';
      break;
    case 'restricted':
      el.textContent = t('videoScanRestrictedBadge');
      el.className = 'scan-badge error';
      break;
    case 'error':
      el.textContent =
        scan.error === 'scan_timeout' ? t('videoScanTimeout') : t('videoScanErrorBadge');
      el.className = 'scan-badge error';
      break;
    default:
      el.textContent = t('videoScanEmptyBadge');
      el.className = 'scan-badge empty';
      break;
  }
}

type DeviceConnectionStatus = 'online' | 'offline' | 'none';

function applyConnectionStatus(
  deviceCount: number,
  lastDeviceStatus: DeviceConnectionStatus = 'none',
) {
  if (lastDeviceStatus === 'online' || deviceCount > 0) {
    setStatus(t('connected'));
  } else if (lastDeviceStatus === 'offline') {
    setStatus(t('lastDeviceOffline'), true);
  } else {
    setStatus(t('deviceHint'));
  }
}

function resolveDeviceIdToSelect(): string {
  if (!settings?.autoSelectLastDevice) {
    return selectedDeviceId && devices.some((d) => d.id === selectedDeviceId)
      ? selectedDeviceId
      : '';
  }

  if (selectedDeviceId && devices.some((d) => d.id === selectedDeviceId)) {
    return selectedDeviceId;
  }

  if (settings.lastDeviceId && devices.some((d) => d.id === settings.lastDeviceId)) {
    return settings.lastDeviceId;
  }

  if (lastDeviceIpHint) {
    const byIp = devices.find((d) => d.ip === lastDeviceIpHint);
    if (byIp) return byIp.id;
  }

  return '';
}

function renderDevices() {
  const select = $<HTMLSelectElement>('device-select');
  select.innerHTML = `<option value="">${t('selectDevice')}</option>`;
  for (const device of devices) {
    const opt = document.createElement('option');
    opt.value = device.id;
    opt.textContent = `${device.name} (${device.ip})`;
    select.appendChild(opt);
  }

  const pick = resolveDeviceIdToSelect();
  if (pick) {
    select.value = pick;
    selectedDeviceId = pick;
  } else {
    selectedDeviceId = select.value;
  }
  updateCastButton();
}

function renderVideos() {
  const list = $('video-list');
  const hint = $('video-hint');
  list.innerHTML = '';
  if (videos.length === 0) {
    hint.classList.remove('hidden');
    hint.textContent = t('videoHint');
    return;
  }
  hint.classList.add('hidden');
  for (const video of videos) {
    const li = document.createElement('li');
    const label = video.title ?? video.url;
    li.textContent = label.length > 60 ? `${label.slice(0, 60)}…` : label;
    li.title = video.url;
    if (video.url === selectedVideoUrl) li.classList.add('selected');
    li.addEventListener('click', () => {
      selectedVideoUrl = video.url;
      list.querySelectorAll('li').forEach((n) => n.classList.remove('selected'));
      li.classList.add('selected');
      updateCastButton();
    });
    list.appendChild(li);
  }
  if (!selectedVideoUrl && videos[0]) {
    selectedVideoUrl = videos[0].url;
    list.querySelector('li')?.classList.add('selected');
  }
  updateCastButton();
}

function updateCastButton() {
  const canCast = Boolean(selectedDeviceId && selectedVideoUrl);
  $<HTMLButtonElement>('btn-cast').disabled = !canCast;
}

function videoHintForScan(
  error?: string,
  hints?: { blobVideoCount: number; isBilibili: boolean },
): string {
  if (error === 'scan_timeout') return t('videoScanTimeoutHint');
  if (error === 'restricted_page' || error === 'no_active_tab') return t('videoScanRestricted');
  if (hints && hints.blobVideoCount > 0) {
    return hints.isBilibili ? t('videoBlobBilibili') : t('videoBlobOnly');
  }
  return t('videoScanEmpty');
}

async function loadData() {
  settings = await sendMessage<AppSettings>('GET_SETTINGS');
  applyI18n();

  const cachedRes = await sendMessage<{
    devices: DlnaDevice[];
    lastDeviceId?: string;
    lastDeviceIp?: string;
  }>('GET_DEVICES', { reconnectLast: false });
  devices = cachedRes.devices;
  if (cachedRes.lastDeviceId) settings.lastDeviceId = cachedRes.lastDeviceId;
  if (cachedRes.lastDeviceIp) lastDeviceIpHint = cachedRes.lastDeviceIp;
  renderDevices();
  applyConnectionStatus(devices.length);

  const shouldReconnect = Boolean(settings.lastDeviceId);
  // Only show "reconnecting" when there is no cached device yet (avoid masking "已连接").
  if (shouldReconnect && devices.length === 0) {
    setStatus(t('reconnecting'));
  }

  type DevicesResponse = {
    devices: DlnaDevice[];
    lastDeviceStatus?: DeviceConnectionStatus;
    lastDeviceId?: string;
    lastDeviceIp?: string;
  };

  setVideoScanStatus(undefined, true);

  const videosPromise = fetchVideosWithTimeout()
    .then((res) => {
      applyVideoScanResult(res);
      return res;
    })
    .catch((err) => {
      applyVideoScanError(err);
      throw err;
    });

  const devicesPromise: Promise<DevicesResponse> = shouldReconnect
    ? sendMessage<DevicesResponse>('GET_DEVICES', { reconnectLast: true }).then((res) => {
        devices = res.devices;
        if (res.lastDeviceId) settings.lastDeviceId = res.lastDeviceId;
        if (res.lastDeviceIp) lastDeviceIpHint = res.lastDeviceIp;
        renderDevices();
        applyConnectionStatus(devices.length, res.lastDeviceStatus ?? 'none');
        return res;
      })
    : Promise.resolve({
        devices: cachedRes.devices,
        lastDeviceStatus: 'none' as const,
        lastDeviceId: cachedRes.lastDeviceId,
        lastDeviceIp: cachedRes.lastDeviceIp,
      });

  const [deviceRes] = await Promise.all([
    devicesPromise,
    videosPromise.catch(() => ({
      videos: [] as DetectedVideo[],
    })),
  ]);

  devices = deviceRes.devices;
  if (deviceRes.lastDeviceId) settings.lastDeviceId = deviceRes.lastDeviceId;
  if (deviceRes.lastDeviceIp) lastDeviceIpHint = deviceRes.lastDeviceIp;
  renderDevices();
  if (!shouldReconnect) {
    applyConnectionStatus(devices.length, deviceRes.lastDeviceStatus ?? 'none');
  }
}

/** Rescan videos only (header ↻ also runs full loadData). */
async function refreshVideos() {
  setVideoScanStatus(undefined, true);
  try {
    const videoRes = await fetchVideosWithTimeout();
    applyVideoScanResult(videoRes);
  } catch (e) {
    applyVideoScanError(e);
  }
}

function addManualVideoUrl() {
  const raw = $<HTMLInputElement>('manual-video-url').value.trim();
  if (!raw) return;
  if (!isCastableUrl(raw)) {
    setStatus(t('videoUrlInvalid'), true);
    return;
  }
  const normalized = normalizeHttpUrl(raw) ?? raw;
  const ep = episodeLabelFromUrl(normalized);
  const pageTitle = $('page-title').textContent?.trim() || '';
  const entry: DetectedVideo = {
    url: normalized,
    title: buildVideoTitle(normalized, {
      documentTitle: pageTitle || document.title,
      vodName: pageTitle || undefined,
      urlLabels: ep ? new Map([[normalized, ep]]) : new Map(),
    }),
    source: 'page-link',
  };
  videos = [...videos.filter((v) => v.url !== raw), entry];
  selectedVideoUrl = raw;
  $<HTMLInputElement>('manual-video-url').value = '';
  renderVideos();
  setVideoScanStatus({
    state: 'found',
    videoCount: videos.length,
    framesScanned: 0,
    iframeCount: 0,
    videoElementCount: 0,
    blobVideoCount: 0,
    htmlMediaHits: 0,
  });
  setStatus(t('videoUrlAdded'));
}

async function scanDevices() {
  setStatus(t('scanning'));
  $<HTMLButtonElement>('btn-scan').disabled = true;
  if (settings?.debug) {
    console.log('[mochi-cast:popup] scan started — see Service Worker console or Settings → debug log');
  }
  try {
    const result = await sendMessage<{
      devices: DlnaDevice[];
      method: string;
      error?: string;
      lastDeviceId?: string;
    }>('DISCOVER_DEVICES', { force: true });
    devices = result.devices;
    if (result.lastDeviceId) {
      settings.lastDeviceId = result.lastDeviceId;
      const saved = devices.find((d) => d.id === result.lastDeviceId);
      if (saved) lastDeviceIpHint = saved.ip;
    }
    renderDevices();
    setStatus(
      devices.length
        ? t('connected')
        : result.error === 'no_devices_found'
          ? t('scanDoneNoDevices')
          : t('deviceHint'),
      devices.length === 0,
    );
  } catch (e) {
    setStatus((e as Error).message, true);
  } finally {
    $<HTMLButtonElement>('btn-scan').disabled = false;
  }
}

async function addManualIp() {
  const ip = $<HTMLInputElement>('manual-ip').value.trim();
  if (!ip) return;
  setStatus(t('scanning'));
  try {
    const result = await sendMessage<{ device: DlnaDevice | null; error?: string }>(
      'ADD_DEVICE_BY_IP',
      { ip },
    );
    if (result.device) {
      devices = [...devices.filter((d) => d.id !== result.device!.id), result.device];
      selectedDeviceId = result.device.id;
      lastDeviceIpHint = result.device.ip;
      settings.lastDeviceId = result.device.id;
      void sendMessage('SAVE_LAST_DEVICE', { deviceId: result.device.id });
      renderDevices();
      $<HTMLInputElement>('manual-ip').value = '';
      setStatus(t('deviceAdded'));
    } else {
      setStatus(result.error ?? t('deviceNotFound'), true);
    }
  } catch (e) {
    setStatus((e as Error).message, true);
  }
}

async function startCast() {
  const video = videos.find((v) => v.url === selectedVideoUrl);
  if (!video || !selectedDeviceId) return;
  setStatus(t('casting'));
  $<HTMLButtonElement>('btn-cast').disabled = true;
  try {
    await sendMessage('CAST_MEDIA', { deviceId: selectedDeviceId, video });
    setStatus(t('castOk'));
    enablePlaybackControls(true);
  } catch (e) {
    setStatus(`${t('castFail')}: ${(e as Error).message}`, true);
  } finally {
    updateCastButton();
  }
}

async function control(action: 'play' | 'pause' | 'stop') {
  try {
    await sendMessage('CONTROL_PLAYBACK', { action });
    if (action === 'stop') enablePlaybackControls(false);
  } catch (e) {
    setStatus((e as Error).message, true);
  }
}

function enablePlaybackControls(enabled: boolean) {
  ['btn-pause', 'btn-play', 'btn-stop'].forEach((id) => {
    $<HTMLButtonElement>(id).disabled = !enabled;
  });
}

function bindEvents() {
  $('btn-video-refresh').addEventListener('click', () => void refreshVideos());
  $('btn-scan').addEventListener('click', () => scanDevices());
  $('btn-add-ip').addEventListener('click', () => addManualIp());
  $('btn-add-video').addEventListener('click', () => addManualVideoUrl());
  $('manual-video-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addManualVideoUrl();
  });
  $('btn-cast').addEventListener('click', () => startCast());
  $('btn-play').addEventListener('click', () => control('play'));
  $('btn-pause').addEventListener('click', () => control('pause'));
  $('btn-stop').addEventListener('click', () => control('stop'));
  $('device-select').addEventListener('change', (e) => {
    selectedDeviceId = (e.target as HTMLSelectElement).value;
    updateCastButton();
    if (selectedDeviceId) {
      void sendMessage('SAVE_LAST_DEVICE', { deviceId: selectedDeviceId });
    }
  });
  $('link-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

async function init() {
  bindEvents();
  await loadData();
  if (devices.length === 0) {
    void scanDevices();
  }
}

init();

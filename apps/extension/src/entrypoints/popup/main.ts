import type { DlnaDevice } from '@mochi-cast/dlna-core';
import type { AppSettings, DetectedVideo } from '../../shared/messages.js';

const STRINGS = {
  zh: {
    title: '麻薯投屏',
    devices: '电视设备',
    scan: '扫描',
    selectDevice: '选择设备…',
    addIp: '添加 IP',
    deviceHint: '请确认电脑与电视在同一 Wi-Fi，并开启电视的无线投屏 / DLNA',
    videos: '检测到的视频',
    videoHint: '请先在网页中播放视频，或全屏后再刷新',
    cast: '开始投屏',
    settings: '设置',
    scanning: '正在扫描局域网…',
    casting: '投屏中…',
    castOk: '已开始投屏',
    castFail: '投屏失败',
    noVideos: '未检测到可投屏视频',
    deviceAdded: '已添加设备',
    deviceNotFound: '未在该 IP 找到 DLNA 设备',
  },
  en: {
    title: 'Mochi Cast',
    devices: 'TV Devices',
    scan: 'Scan',
    selectDevice: 'Select device…',
    addIp: 'Add IP',
    deviceHint: 'Ensure PC and TV are on the same Wi-Fi with DLNA enabled',
    videos: 'Detected Videos',
    videoHint: 'Play the video on the page first, then refresh',
    cast: 'Start Casting',
    settings: 'Settings',
    scanning: 'Scanning local network…',
    casting: 'Casting…',
    castOk: 'Casting started',
    castFail: 'Cast failed',
    noVideos: 'No castable video found',
    deviceAdded: 'Device added',
    deviceNotFound: 'No DLNA device at this IP',
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

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

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

function renderDevices() {
  const select = $<HTMLSelectElement>('device-select');
  const current = select.value;
  select.innerHTML = `<option value="">${t('selectDevice')}</option>`;
  for (const device of devices) {
    const opt = document.createElement('option');
    opt.value = device.id;
    opt.textContent = `${device.name} (${device.ip})`;
    select.appendChild(opt);
  }
  if (settings.autoSelectLastDevice && settings.lastDeviceId) {
    select.value = settings.lastDeviceId;
    selectedDeviceId = settings.lastDeviceId;
  } else if (current) {
    select.value = current;
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

async function loadData() {
  settings = await sendMessage<AppSettings>('GET_SETTINGS');
  applyI18n();
  const [deviceRes, videoRes] = await Promise.all([
    sendMessage<{ devices: DlnaDevice[] }>('GET_DEVICES'),
    sendMessage<{ videos: DetectedVideo[]; pageTitle?: string }>('GET_VIDEOS'),
  ]);
  devices = deviceRes.devices;
  videos = videoRes.videos;
  if (videoRes.pageTitle) $('page-title').textContent = videoRes.pageTitle;
  renderDevices();
  renderVideos();
}

async function scanDevices() {
  setStatus(t('scanning'));
  $<HTMLButtonElement>('btn-scan').disabled = true;
  try {
    const result = await sendMessage<{ devices: DlnaDevice[]; method: string }>(
      'DISCOVER_DEVICES',
      { force: true },
    );
    devices = result.devices;
    renderDevices();
    setStatus(devices.length ? `${devices.length} device(s)` : t('deviceHint'));
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
  $('btn-refresh').addEventListener('click', () => loadData());
  $('btn-scan').addEventListener('click', () => scanDevices());
  $('btn-add-ip').addEventListener('click', () => addManualIp());
  $('btn-cast').addEventListener('click', () => startCast());
  $('btn-play').addEventListener('click', () => control('play'));
  $('btn-pause').addEventListener('click', () => control('pause'));
  $('btn-stop').addEventListener('click', () => control('stop'));
  $('device-select').addEventListener('change', (e) => {
    selectedDeviceId = (e.target as HTMLSelectElement).value;
    updateCastButton();
  });
  $('link-options').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

async function init() {
  bindEvents();
  await loadData();
  await scanDevices();
}

init();

import type { AppSettings } from '../../shared/messages.js';

interface MessageResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function sendMessage<T>(type: string, payload?: unknown): Promise<T> {
  const response = (await chrome.runtime.sendMessage({ type, payload })) as MessageResult<T>;
  if (!response.ok) throw new Error(response.error ?? 'Unknown error');
  return response.data as T;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function loadSettings() {
  const settings = await sendMessage<AppSettings>('GET_SETTINGS');
  $<HTMLSelectElement>('language').value = settings.language;
  $<HTMLInputElement>('autoSelectLastDevice').checked = settings.autoSelectLastDevice;
  $<HTMLInputElement>('discoveryTimeoutMs').value = String(settings.discoveryTimeoutMs);
  $<HTMLInputElement>('subnetPrefix').value = settings.subnetPrefix ?? '';
  $<HTMLInputElement>('debug').checked = settings.debug;
  if (settings.debug) await refreshDebugLogs();
}

async function refreshDebugLogs() {
  try {
    const { text, entries } = await sendMessage<{ text: string; entries: unknown[] }>(
      'GET_DEBUG_LOGS',
    );
    const el = $<HTMLPreElement>('debug-log');
    el.textContent =
      entries.length > 0
        ? text
        : '（暂无日志。请保存「启用调试」后，在 Popup 点「扫描」，再刷新。）';
  } catch (e) {
    $<HTMLPreElement>('debug-log').textContent = `加载日志失败: ${(e as Error).message}`;
  }
}

async function clearDebugLogs() {
  await sendMessage('CLEAR_DEBUG_LOGS');
  $<HTMLPreElement>('debug-log').textContent = '（已清空）';
}

async function copyDebugLogs() {
  const text = $<HTMLPreElement>('debug-log').textContent ?? '';
  await navigator.clipboard.writeText(text);
  $<HTMLSpanElement>('save-status').textContent = '日志已复制';
  setTimeout(() => {
    $<HTMLSpanElement>('save-status').textContent = '';
  }, 2000);
}

async function saveSettings() {
  const payload: Partial<AppSettings> = {
    language: $<HTMLSelectElement>('language').value as 'zh' | 'en',
    autoSelectLastDevice: $<HTMLInputElement>('autoSelectLastDevice').checked,
    discoveryTimeoutMs: Number($<HTMLInputElement>('discoveryTimeoutMs').value),
    subnetPrefix: $<HTMLInputElement>('subnetPrefix').value.trim() || undefined,
    debug: $<HTMLInputElement>('debug').checked,
  };
  await sendMessage<AppSettings>('SAVE_SETTINGS', payload);
  $<HTMLSpanElement>('save-status').textContent = '已保存';
  if (payload.debug) await refreshDebugLogs();
  setTimeout(() => {
    $<HTMLSpanElement>('save-status').textContent = '';
  }, 2000);
}

$('btn-save').addEventListener('click', () => saveSettings());
$('btn-refresh-logs').addEventListener('click', () => refreshDebugLogs());
$('btn-clear-logs').addEventListener('click', () => clearDebugLogs());
$('btn-copy-logs').addEventListener('click', () => copyDebugLogs());
$('debug').addEventListener('change', () => {
  if ($<HTMLInputElement>('debug').checked) void refreshDebugLogs();
});

loadSettings();

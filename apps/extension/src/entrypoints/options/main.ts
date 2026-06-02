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
  $<HTMLInputElement>('debug').checked = settings.debug;
}

async function saveSettings() {
  const payload: Partial<AppSettings> = {
    language: $<HTMLSelectElement>('language').value as 'zh' | 'en',
    autoSelectLastDevice: $<HTMLInputElement>('autoSelectLastDevice').checked,
    discoveryTimeoutMs: Number($<HTMLInputElement>('discoveryTimeoutMs').value),
    debug: $<HTMLInputElement>('debug').checked,
  };
  await sendMessage<AppSettings>('SAVE_SETTINGS', payload);
  $<HTMLSpanElement>('save-status').textContent = '已保存';
  setTimeout(() => {
    $<HTMLSpanElement>('save-status').textContent = '';
  }, 2000);
}

$('btn-save').addEventListener('click', () => saveSettings());
loadSettings();

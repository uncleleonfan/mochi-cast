import type { AppSettings } from '../../shared/messages.js';
import { optionsT, type OptionsLang } from './i18n.js';

interface MessageResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

let currentLang: OptionsLang = 'zh';

async function sendMessage<T>(type: string, payload?: unknown): Promise<T> {
  const response = (await chrome.runtime.sendMessage({ type, payload })) as MessageResult<T>;
  if (!response.ok) throw new Error(response.error ?? 'Unknown error');
  return response.data as T;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function t(key: Parameters<typeof optionsT>[1]): string {
  return optionsT(currentLang, key);
}

function applyOptionsI18n() {
  document.documentElement.lang = currentLang === 'en' ? 'en' : 'zh-CN';
  document.title = `${t('pageTitle')} — Mochi Cast`;
  $<HTMLElement>('opt-page-title').textContent = t('pageTitle');
  const subtitle = $<HTMLElement>('opt-subtitle');
  subtitle.textContent = currentLang === 'en' ? '' : 'Mochi Cast';
  subtitle.style.display = currentLang === 'en' ? 'none' : '';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as Parameters<typeof optionsT>[1];
    if (key) el.textContent = t(key);
  });
  $<HTMLButtonElement>('btn-save').textContent = t('save');
}

async function loadSettings() {
  const settings = await sendMessage<AppSettings>('GET_SETTINGS');
  currentLang = settings.language === 'en' ? 'en' : 'zh';
  applyOptionsI18n();
  $<HTMLSelectElement>('language').value = settings.language;
  $<HTMLInputElement>('autoSelectLastDevice').checked = settings.autoSelectLastDevice;
  $<HTMLInputElement>('discoveryTimeoutMs').value = String(settings.discoveryTimeoutMs);
  $<HTMLInputElement>('subnetPrefix').value = settings.subnetPrefix ?? '';
  $<HTMLInputElement>('debug').checked = settings.debug;
  $<HTMLPreElement>('debug-log').textContent = t('debugLogPlaceholder');
  if (settings.debug) await refreshDebugLogs();
}

async function refreshDebugLogs() {
  try {
    const { text, entries } = await sendMessage<{ text: string; entries: unknown[] }>(
      'GET_DEBUG_LOGS',
    );
    const el = $<HTMLPreElement>('debug-log');
    el.textContent = entries.length > 0 ? text : t('debugLogEmpty');
  } catch (e) {
    $<HTMLPreElement>('debug-log').textContent = `${t('loadLogsFailed')}: ${(e as Error).message}`;
  }
}

async function clearDebugLogs() {
  await sendMessage('CLEAR_DEBUG_LOGS');
  $<HTMLPreElement>('debug-log').textContent = t('debugLogCleared');
}

async function copyDebugLogs() {
  const text = $<HTMLPreElement>('debug-log').textContent ?? '';
  await navigator.clipboard.writeText(text);
  $<HTMLSpanElement>('save-status').textContent = t('logsCopied');
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
  currentLang = payload.language === 'en' ? 'en' : 'zh';
  applyOptionsI18n();
  $<HTMLSpanElement>('save-status').textContent = t('saved');
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
$('language').addEventListener('change', () => {
  currentLang = $<HTMLSelectElement>('language').value === 'en' ? 'en' : 'zh';
  applyOptionsI18n();
});

loadSettings();

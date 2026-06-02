import type { AppSettings } from '../shared/messages.js';
import { DEFAULT_SETTINGS } from '../shared/messages.js';

const STORAGE_KEY = 'mochi_cast_settings';

export async function loadSettings(): Promise<AppSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY] as Partial<AppSettings> | undefined) };
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await loadSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function getLastDeviceId(): Promise<string | undefined> {
  const settings = await loadSettings();
  return settings.lastDeviceId;
}

export async function setLastDeviceId(deviceId: string): Promise<void> {
  await saveSettings({ lastDeviceId: deviceId });
}

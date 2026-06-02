import type { DlnaDevice } from '@mochi-cast/dlna-core';
import { loadSettings, saveSettings } from './storage.js';

const DEVICE_STORE_KEY = 'mochi_cast_devices';

export interface DeviceStore {
  lastDevice: DlnaDevice | null;
  devices: DlnaDevice[];
}

export type LastDeviceStatus = 'online' | 'offline' | 'none';

function mergeDeviceList(...lists: DlnaDevice[][]): DlnaDevice[] {
  const map = new Map<string, DlnaDevice>();
  for (const list of lists) {
    for (const device of list) {
      map.set(device.id, device);
    }
  }
  return Array.from(map.values());
}

export async function loadDeviceStore(): Promise<DeviceStore> {
  const result = await chrome.storage.local.get(DEVICE_STORE_KEY);
  const store = result[DEVICE_STORE_KEY] as DeviceStore | undefined;
  return store ?? { lastDevice: null, devices: [] };
}

export async function persistDeviceStore(
  devices: DlnaDevice[],
  lastDevice?: DlnaDevice | null,
): Promise<void> {
  const current = await loadDeviceStore();
  const nextLast =
    lastDevice === undefined ? current.lastDevice : lastDevice;
  const nextDevices = mergeDeviceList(current.devices, devices);
  await chrome.storage.local.set({
    [DEVICE_STORE_KEY]: {
      lastDevice: nextLast,
      devices: nextDevices,
    },
  });
}

/** Remember the TV the user last used (survives service worker restarts). */
export async function saveLastDevice(device: DlnaDevice): Promise<void> {
  const store = await loadDeviceStore();
  const devices = mergeDeviceList(store.devices, [device]);
  await chrome.storage.local.set({
    [DEVICE_STORE_KEY]: { lastDevice: device, devices },
  });
  await saveSettings({ lastDeviceId: device.id });
}

export async function getLastSavedDevice(): Promise<DlnaDevice | null> {
  const store = await loadDeviceStore();
  if (store.lastDevice) return store.lastDevice;

  const settings = await loadSettings();
  if (!settings.lastDeviceId) return null;
  return store.devices.find((d) => d.id === settings.lastDeviceId) ?? null;
}

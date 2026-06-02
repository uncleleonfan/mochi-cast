import { saveLastDevice } from '../lib/device-store.js';
import {
  addDeviceByIp,
  discoverDevices,
  getCachedDevices,
  hydrateDevicesFromStorage,
  mergeDevices,
  reconnectLastDevice,
  resolveDeviceFromManual,
} from '../lib/discovery/manager.js';
import {
  castToDevice,
  controlPlayback,
  getPlaybackState,
} from '../lib/cast-manager.js';
import {
  clearLogBuffer,
  formatLogLines,
  getLogBuffer,
  loadPersistedLogs,
  log,
  logError,
  setDebugEnabled,
} from '../lib/debug-log.js';
import { getVideosFromTab } from '../lib/get-videos-from-tab.js';
import { loadSettings, saveSettings } from '../lib/storage.js';
import type {
  MessagePayloads,
  MessageResponses,
  MessageType,
} from '../shared/messages.js';

export default defineBackground(() => {
  void hydrateDevicesFromStorage();

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'mochi-cast',
      title: chrome.i18n.getMessage('contextCast'),
      contexts: ['page', 'video'],
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'mochi-cast' && tab?.id) {
      chrome.action.openPopup?.();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message.type as MessageType, message.payload)
      .then((result) => sendResponse({ ok: true, data: result }))
      .catch((error: Error) => {
        logError('background', `message_failed:${message.type}`, error);
        sendResponse({ ok: false, error: error.message ?? String(error) });
      });
    return true;
  });
});

async function handleMessage<T extends MessageType>(
  type: T,
  payload?: MessagePayloads[T],
): Promise<MessageResponses[T]> {
  const settings = await loadSettings();
  setDebugEnabled(settings.debug);
  log('background', 'message', { type, payload });

  switch (type) {
    case 'DISCOVER_DEVICES': {
      const manualIps = settings.manualDevices.map((d) => d.ip);
      const result = await discoverDevices({
        timeoutMs: settings.discoveryTimeoutMs,
        manualIps,
        debug: settings.debug,
      });
      return {
        devices: result.devices,
        method: result.method,
        error: result.error,
        lastDeviceId: result.lastDeviceId,
      } as MessageResponses[T];
    }
    case 'GET_DEVICES': {
      const p = payload as MessagePayloads['GET_DEVICES'];
      await hydrateDevicesFromStorage();
      let lastDeviceStatus: 'online' | 'offline' | 'none' = 'none';
      let lastDevice: import('@mochi-cast/dlna-core').DlnaDevice | null = null;
      if (p?.reconnectLast !== false) {
        const reconnected = await reconnectLastDevice();
        lastDeviceStatus = reconnected.status;
        lastDevice = reconnected.device;
      }
      if (!lastDevice) {
        const { getLastSavedDevice } = await import('../lib/device-store.js');
        lastDevice = await getLastSavedDevice();
      }
      const freshSettings = await loadSettings();
      return {
        devices: getCachedDevices(),
        lastDeviceStatus,
        lastDeviceId: lastDevice?.id ?? freshSettings.lastDeviceId,
        lastDeviceIp: lastDevice?.ip,
      } as MessageResponses[T];
    }
    case 'SAVE_LAST_DEVICE': {
      const p = payload as MessagePayloads['SAVE_LAST_DEVICE'];
      const device = getCachedDevices().find((d) => d.id === p.deviceId);
      if (device) await saveLastDevice(device);
      return { success: Boolean(device) } as MessageResponses[T];
    }
    case 'ADD_DEVICE_BY_IP': {
      const p = payload as MessagePayloads['ADD_DEVICE_BY_IP'];
      const { device, error } = await addDeviceByIp(p.ip, p.name);
      if (!device) {
        return { device: null, error: error ?? 'Device not found at IP' } as MessageResponses[T];
      }
      const settings = await loadSettings();
      const manualDevices = [
        ...settings.manualDevices.filter((d) => d.ip !== p.ip),
        { id: device.id, ip: p.ip, name: device.name, location: device.location },
      ];
      await saveSettings({ manualDevices });
      await saveLastDevice(device);
      return { device } as MessageResponses[T];
    }
    case 'CAST_MEDIA': {
      const p = payload as MessagePayloads['CAST_MEDIA'];
      const devices = getCachedDevices();
      const device = devices.find((d) => d.id === p.deviceId);
      if (!device) throw new Error('Device not found');
      await castToDevice(device, p.video);
      await saveLastDevice(device);
      return { success: true } as MessageResponses[T];
    }
    case 'CONTROL_PLAYBACK': {
      const p = payload as MessagePayloads['CONTROL_PLAYBACK'];
      await controlPlayback(p.action, p.seconds);
      return { success: true } as MessageResponses[T];
    }
    case 'GET_VIDEOS': {
      const p = payload as MessagePayloads['GET_VIDEOS'];
      const tabId = p.tabId ?? (await getActiveTabId());
      if (!tabId) {
        return { videos: [], error: 'no_active_tab' } as unknown as MessageResponses[T];
      }
      const result = await getVideosFromTab(tabId);
      log('videos', 'scan_result', {
        count: result.videos.length,
        error: result.error,
        pageUrl: result.pageUrl,
      });
      return result as unknown as MessageResponses[T];
    }
    case 'GET_SETTINGS':
      return (await loadSettings()) as MessageResponses[T];
    case 'SAVE_SETTINGS': {
      const saved = await saveSettings(payload as MessagePayloads['SAVE_SETTINGS']);
      if (saved.manualDevices.length) {
        const resolved: import('@mochi-cast/dlna-core').DlnaDevice[] = [];
        for (const manual of saved.manualDevices) {
          const device = await resolveDeviceFromManual(manual);
          if (device) resolved.push(device);
        }
        if (resolved.length) {
          const { setCachedDevices } = await import('../lib/discovery/manager.js');
          setCachedDevices(mergeDevices(getCachedDevices(), resolved));
        }
      }
      return saved as MessageResponses[T];
    }
    case 'GET_PLAYBACK_STATE':
      return (await getPlaybackState()) as MessageResponses[T];
    case 'GET_DEBUG_LOGS': {
      await loadPersistedLogs();
      return {
        entries: getLogBuffer(),
        text: formatLogLines(getLogBuffer()),
      } as MessageResponses[T];
    }
    case 'CLEAR_DEBUG_LOGS':
      clearLogBuffer();
      log('background', 'debug_logs_cleared');
      return { success: true } as MessageResponses[T];
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

import {
  addDeviceByIp,
  discoverDevices,
  getCachedDevices,
  mergeDevices,
  resolveDeviceFromManual,
} from '../lib/discovery/manager.js';
import {
  castToDevice,
  controlPlayback,
  getPlaybackState,
} from '../lib/cast-manager.js';
import { loadSettings, saveSettings, setLastDeviceId } from '../lib/storage.js';
import type {
  MessagePayloads,
  MessageResponses,
  MessageType,
} from '../shared/messages.js';

export default defineBackground(() => {
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
      .catch((error: Error) =>
        sendResponse({ ok: false, error: error.message ?? String(error) }),
      );
    return true;
  });
});

async function handleMessage<T extends MessageType>(
  type: T,
  payload?: MessagePayloads[T],
): Promise<MessageResponses[T]> {
  switch (type) {
    case 'DISCOVER_DEVICES': {
      const settings = await loadSettings();
      const manualIps = settings.manualDevices.map((d) => d.ip);
      const result = await discoverDevices({
        timeoutMs: settings.discoveryTimeoutMs,
        manualIps,
      });
      return { devices: result.devices, method: result.method } as MessageResponses[T];
    }
    case 'GET_DEVICES':
      return { devices: getCachedDevices() } as MessageResponses[T];
    case 'ADD_DEVICE_BY_IP': {
      const p = payload as MessagePayloads['ADD_DEVICE_BY_IP'];
      const device = await addDeviceByIp(p.ip, p.name);
      if (!device) {
        return { device: null, error: 'Device not found at IP' } as MessageResponses[T];
      }
      const settings = await loadSettings();
      const manualDevices = [
        ...settings.manualDevices.filter((d) => d.ip !== p.ip),
        { id: device.id, ip: p.ip, name: device.name, location: device.location },
      ];
      await saveSettings({ manualDevices });
      return { device } as MessageResponses[T];
    }
    case 'CAST_MEDIA': {
      const p = payload as MessagePayloads['CAST_MEDIA'];
      const devices = getCachedDevices();
      const device = devices.find((d) => d.id === p.deviceId);
      if (!device) throw new Error('Device not found');
      await castToDevice(device, p.video);
      await setLastDeviceId(device.id);
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
      if (!tabId) return { videos: [] } as unknown as MessageResponses[T];
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'SCAN_VIDEOS' });
        return response as MessageResponses[T];
      } catch {
        return { videos: [] } as unknown as MessageResponses[T];
      }
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
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

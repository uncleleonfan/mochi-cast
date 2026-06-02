export type MessageType =
  | 'DISCOVER_DEVICES'
  | 'GET_DEVICES'
  | 'ADD_DEVICE_BY_IP'
  | 'CAST_MEDIA'
  | 'CONTROL_PLAYBACK'
  | 'GET_VIDEOS'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_PLAYBACK_STATE';

export interface DetectedVideo {
  url: string;
  title?: string;
  mimeType?: string;
  source: 'video-element' | 'source-tag' | 'network' | 'page-link';
}

export interface AppSettings {
  language: 'zh' | 'en';
  discoveryTimeoutMs: number;
  autoSelectLastDevice: boolean;
  lastDeviceId?: string;
  manualDevices: ManualDevice[];
  debug: boolean;
}

export interface ManualDevice {
  id: string;
  ip: string;
  name?: string;
  location?: string;
}

export interface PlaybackState {
  deviceId?: string;
  isCasting: boolean;
  transportState?: string;
  position?: string;
  duration?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'zh',
  discoveryTimeoutMs: 8000,
  autoSelectLastDevice: true,
  manualDevices: [],
  debug: false,
};

export interface MessagePayloads {
  DISCOVER_DEVICES: { force?: boolean };
  GET_DEVICES: undefined;
  ADD_DEVICE_BY_IP: { ip: string; name?: string };
  CAST_MEDIA: { deviceId: string; video: DetectedVideo };
  CONTROL_PLAYBACK: { action: 'play' | 'pause' | 'stop' | 'seek'; seconds?: number };
  GET_VIDEOS: { tabId?: number };
  GET_SETTINGS: undefined;
  SAVE_SETTINGS: Partial<AppSettings>;
  GET_PLAYBACK_STATE: undefined;
}

export interface MessageResponses {
  DISCOVER_DEVICES: { devices: import('@mochi-cast/dlna-core').DlnaDevice[]; method: string };
  GET_DEVICES: { devices: import('@mochi-cast/dlna-core').DlnaDevice[] };
  ADD_DEVICE_BY_IP: { device: import('@mochi-cast/dlna-core').DlnaDevice | null; error?: string };
  CAST_MEDIA: { success: boolean; error?: string };
  CONTROL_PLAYBACK: { success: boolean; error?: string };
  GET_VIDEOS: { videos: DetectedVideo[]; pageTitle?: string };
  GET_SETTINGS: AppSettings;
  SAVE_SETTINGS: AppSettings;
  GET_PLAYBACK_STATE: PlaybackState;
}

export function sendMessage<T extends MessageType>(
  type: T,
  payload?: MessagePayloads[T],
): Promise<MessageResponses[T]> {
  return chrome.runtime.sendMessage({ type, payload }) as Promise<MessageResponses[T]>;
}

export type MessageType =
  | 'DISCOVER_DEVICES'
  | 'GET_DEVICES'
  | 'SAVE_LAST_DEVICE'
  | 'ADD_DEVICE_BY_IP'
  | 'CAST_MEDIA'
  | 'CONTROL_PLAYBACK'
  | 'GET_VIDEOS'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_PLAYBACK_STATE'
  | 'GET_DEBUG_LOGS'
  | 'CLEAR_DEBUG_LOGS';

export interface DetectedVideo {
  url: string;
  title?: string;
  mimeType?: string;
  source:
    | 'video-element'
    | 'source-tag'
    | 'network'
    | 'page-link'
    | 'iframe-src'
    | 'page-query'
    | 'script-json';
}

export interface VideoScanDiagnostics {
  state: 'scanning' | 'found' | 'empty' | 'restricted' | 'error';
  videoCount: number;
  framesScanned: number;
  iframeCount: number;
  videoElementCount: number;
  blobVideoCount: number;
  htmlMediaHits: number;
  pageUrl?: string;
  error?: string;
}

export interface AppSettings {
  language: 'zh' | 'en';
  discoveryTimeoutMs: number;
  /** Optional LAN prefix override, e.g. 192.168.31 (scanned first). */
  subnetPrefix?: string;
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

export interface DebugLogEntry {
  ts: number;
  level: string;
  scope: string;
  message: string;
  data?: unknown;
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
  discoveryTimeoutMs: 20_000,
  autoSelectLastDevice: true,
  manualDevices: [],
  debug: false,
};

export interface MessagePayloads {
  DISCOVER_DEVICES: { force?: boolean };
  GET_DEVICES: { reconnectLast?: boolean } | undefined;
  SAVE_LAST_DEVICE: { deviceId: string };
  ADD_DEVICE_BY_IP: { ip: string; name?: string };
  CAST_MEDIA: { deviceId: string; video: DetectedVideo };
  CONTROL_PLAYBACK: { action: 'play' | 'pause' | 'stop' | 'seek'; seconds?: number };
  GET_VIDEOS: { tabId?: number };
  GET_SETTINGS: undefined;
  SAVE_SETTINGS: Partial<AppSettings>;
  GET_PLAYBACK_STATE: undefined;
  GET_DEBUG_LOGS: undefined;
  CLEAR_DEBUG_LOGS: undefined;
}

export interface MessageResponses {
  DISCOVER_DEVICES: {
    devices: import('@mochi-cast/dlna-core').DlnaDevice[];
    method: string;
    error?: string;
    lastDeviceId?: string;
  };
  GET_DEVICES: {
    devices: import('@mochi-cast/dlna-core').DlnaDevice[];
    lastDeviceStatus?: 'online' | 'offline' | 'none';
    /** Device id to select after reconnect (may differ from stale settings). */
    lastDeviceId?: string;
    lastDeviceIp?: string;
  };
  SAVE_LAST_DEVICE: { success: boolean };
  ADD_DEVICE_BY_IP: { device: import('@mochi-cast/dlna-core').DlnaDevice | null; error?: string };
  CAST_MEDIA: { success: boolean; error?: string };
  CONTROL_PLAYBACK: { success: boolean; error?: string };
  GET_VIDEOS: {
    videos: DetectedVideo[];
    pageTitle?: string;
    pageUrl?: string;
    error?: string;
    hints?: { blobVideoCount: number; isBilibili: boolean; isDouyin: boolean };
    scan?: VideoScanDiagnostics;
  };
  GET_SETTINGS: AppSettings;
  SAVE_SETTINGS: AppSettings;
  GET_PLAYBACK_STATE: PlaybackState;
  GET_DEBUG_LOGS: { entries: DebugLogEntry[]; text: string };
  CLEAR_DEBUG_LOGS: { success: boolean };
}

export function sendMessage<T extends MessageType>(
  type: T,
  payload?: MessagePayloads[T],
): Promise<MessageResponses[T]> {
  return chrome.runtime.sendMessage({ type, payload }) as Promise<MessageResponses[T]>;
}

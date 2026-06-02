export interface DlnaDevice {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  ip: string;
  location: string;
  avTransportUrl?: string;
  renderingControlUrl?: string;
  friendlyName?: string;
}

export interface MediaItem {
  url: string;
  title?: string;
  mimeType?: string;
}

export interface TransportInfo {
  state: 'PLAYING' | 'PAUSED_PLAYBACK' | 'STOPPED' | 'NO_MEDIA_PRESENT' | 'TRANSITIONING' | string;
  status: string;
  speed: string;
}

export interface PositionInfo {
  track: number;
  duration: string;
  relTime: string;
  absTime: string;
}

export interface SsdpResponse {
  usn: string;
  location: string;
  server?: string;
  st?: string;
  headers: Record<string, string>;
}

export interface UdpTransport {
  send(message: string, address: string, port: number): Promise<void>;
  listen(port: number, onMessage: (data: string, remoteAddress: string) => void): Promise<() => void>;
}

export interface DiscoveryOptions {
  timeoutMs?: number;
  searchTarget?: string;
  udpTransport?: UdpTransport;
}

export interface DeviceProfile {
  id: string;
  name: string;
  /** Extra SOAP headers or URI tweaks for vendor compatibility */
  setUriDelayMs?: number;
  requiresMetadata?: boolean;
}

export const DEFAULT_SEARCH_TARGET =
  'urn:schemas-upnp-org:device:MediaRenderer:1';

export const SSDP_MULTICAST_ADDRESS = '239.255.255.250';
export const SSDP_PORT = 1900;

export const AV_TRANSPORT_SERVICE = 'urn:schemas-upnp-org:service:AVTransport:1';
export const RENDERING_CONTROL_SERVICE =
  'urn:schemas-upnp-org:service:RenderingControl:1';

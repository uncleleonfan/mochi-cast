import { discoverViaSsdp, parseDeviceDescription, probeDeviceAtIp, scanSubnetForDevices } from './discovery.js';
import { AvTransportClient } from './av-transport.js';
import type {
  DeviceProfile,
  DiscoveryOptions,
  DlnaDevice,
  MediaItem,
  PositionInfo,
  TransportInfo,
  UdpTransport,
} from './types.js';

export { discoverViaSsdp, parseDeviceDescription, probeDeviceAtIp, scanSubnetForDevices };
export { AvTransportClient };
export * from './types.js';
export * from './soap.js';
export type {
  DiscoveryTrace,
  NormalizedProbeTarget,
  ProbeAttempt,
  ProbeOptions,
  ProbeResult,
  SubnetScanOptions,
} from './discovery.js';
export {
  buildProbeOrigins,
  buildReconnectProbeUrls,
  normalizeProbeTarget,
  probeDeviceDetailed,
  reconnectProbeDevice,
  COMMON_PROBE_PORTS,
  FAST_PROBE_PORTS,
  PROBE_HTTP_PROFILES,
} from './discovery.js';
export * from './discovery.js';
export * from './profiles.js';

export async function fetchDeviceDescription(
  location: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<DlnaDevice | null> {
  try {
    const response = await fetchFn(location, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    const xml = await response.text();
    return parseDeviceDescription(xml, location);
  } catch {
    return null;
  }
}

export class DlnaController {
  private readonly avTransport: AvTransportClient;

  constructor(
    private readonly device: DlnaDevice,
    private readonly profile?: DeviceProfile,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    if (!device.avTransportUrl) {
      throw new Error('Device has no AVTransport URL');
    }
    this.avTransport = new AvTransportClient(device.avTransportUrl, fetchFn);
  }

  get deviceInfo(): DlnaDevice {
    return this.device;
  }

  async setMedia(item: MediaItem, withMetadata = this.profile?.requiresMetadata ?? true): Promise<void> {
    await this.avTransport.setAvTransportUri(item, withMetadata);
    if (this.profile?.setUriDelayMs) {
      await sleep(this.profile.setUriDelayMs);
    }
  }

  async play(): Promise<void> {
    await this.avTransport.play();
  }

  async pause(): Promise<void> {
    await this.avTransport.pause();
  }

  async stop(): Promise<void> {
    await this.avTransport.stop();
  }

  async seek(seconds: number): Promise<void> {
    await this.avTransport.seek(formatSeekTarget(seconds));
  }

  async cast(item: MediaItem): Promise<void> {
    await this.setMedia(item);
    await this.play();
  }

  async getTransportInfo(): Promise<TransportInfo> {
    return this.avTransport.getTransportInfo();
  }

  async getPositionInfo(): Promise<PositionInfo> {
    return this.avTransport.getPositionInfo();
  }
}

function formatSeekTarget(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function discoverDevices(
  options: DiscoveryOptions & {
    subnetPrefix?: string;
    fetchFn?: typeof fetch;
  } = {},
): Promise<DlnaDevice[]> {
  const fetchFn = options.fetchFn ?? fetch;
  const devices = new Map<string, DlnaDevice>();

  if (options.udpTransport) {
    const ssdpDevices = await discoverViaSsdp(options.udpTransport, options);
    for (const device of ssdpDevices) {
      const detailed = await fetchDeviceDescription(device.location, fetchFn);
      if (detailed) devices.set(detailed.id, detailed);
    }
  }

  if (options.subnetPrefix) {
    const scanned = await scanSubnetForDevices(options.subnetPrefix, fetchFn);
    for (const device of scanned) {
      devices.set(device.id, device);
    }
  }

  return Array.from(devices.values());
}

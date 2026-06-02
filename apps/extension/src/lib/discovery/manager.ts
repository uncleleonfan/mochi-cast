import {
  fetchDeviceDescription,
  probeDeviceAtIp,
  scanSubnetForDevices,
  type DlnaDevice,
} from '@mochi-cast/dlna-core';

export type DiscoveryMethod = 'subnet-scan' | 'manual' | 'cached';

export interface DiscoveryResult {
  devices: DlnaDevice[];
  method: DiscoveryMethod;
  error?: string;
}

let cachedDevices: DlnaDevice[] = [];

export function getCachedDevices(): DlnaDevice[] {
  return [...cachedDevices];
}

export function setCachedDevices(devices: DlnaDevice[]): void {
  cachedDevices = devices;
}

export function mergeDevices(...lists: DlnaDevice[][]): DlnaDevice[] {
  const map = new Map<string, DlnaDevice>();
  for (const list of lists) {
    for (const device of list) {
      map.set(device.id, device);
    }
  }
  return Array.from(map.values());
}

interface NetworkInterface {
  address: string;
  prefixLength: number;
  name: string;
}

type SystemNetwork = {
  getNetworkInterfaces: (callback: (interfaces: NetworkInterface[]) => void) => void;
};

export async function getLocalSubnetPrefix(): Promise<string | null> {
  const network = (chrome.system as { network?: SystemNetwork }).network;
  if (!network?.getNetworkInterfaces) {
    return null;
  }

  return new Promise((resolve) => {
    network.getNetworkInterfaces((interfaces) => {
      if (chrome.runtime.lastError || !interfaces?.length) {
        resolve(null);
        return;
      }

      for (const iface of interfaces) {
        if (!iface.address || iface.address.startsWith('127.')) continue;
        if (iface.address.includes(':')) continue; // skip IPv6
        const parts = iface.address.split('.');
        if (parts.length !== 4) continue;
        resolve(`${parts[0]}.${parts[1]}.${parts[2]}`);
        return;
      }
      resolve(null);
    });
  });
}

export async function discoverDevices(options: {
  timeoutMs?: number;
  manualIps?: string[];
  includeSubnetScan?: boolean;
}): Promise<DiscoveryResult> {
  const manualIps = options.manualIps ?? [];
  const devices: DlnaDevice[] = [];

  for (const ip of manualIps) {
    const device = await probeDeviceAtIp(ip, extensionFetch);
    if (device) devices.push(device);
  }

  if (options.includeSubnetScan !== false) {
    const prefix = await getLocalSubnetPrefix();
    if (prefix) {
      const scanned = await scanSubnetForDevices(prefix, extensionFetch, {
        concurrency: 24,
      });
      devices.push(...scanned);
    }
  }

  const merged = mergeDevices(cachedDevices, devices);
  cachedDevices = merged;

  return {
    devices: merged,
    method: manualIps.length > 0 ? 'manual' : 'subnet-scan',
  };
}

export async function addDeviceByIp(ip: string, name?: string): Promise<DlnaDevice | null> {
  const device = await probeDeviceAtIp(ip.trim(), extensionFetch);
  if (!device) return null;
  if (name) device.name = name;
  cachedDevices = mergeDevices(cachedDevices, [device]);
  return device;
}

export async function resolveDeviceFromManual(
  manual: { ip: string; name?: string; location?: string },
): Promise<DlnaDevice | null> {
  if (manual.location) {
    const device = await fetchDeviceDescription(manual.location, extensionFetch);
    if (device) return device;
  }
  return addDeviceByIp(manual.ip, manual.name);
}

/** Extension fetch bypasses page CORS for LAN device communication */
async function extensionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init);
}

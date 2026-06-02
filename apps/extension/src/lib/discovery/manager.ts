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

/** Common /24 prefixes when automatic detection is unavailable (Windows desktop). */
const COMMON_SUBNET_PREFIXES = ['192.168.1', '192.168.0', '192.168.31', '10.0.0'];

function prefixFromIpv4(address: string): string | null {
  if (!address || address.startsWith('127.')) return null;
  if (address.includes(':')) return null;
  const parts = address.split('.');
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

/** Chrome OS only — chrome.system is undefined on Windows/macOS extensions. */
async function getPrefixFromChromeSystem(): Promise<string | null> {
  type GetNetworkInterfaces = (
    callback: (interfaces: NetworkInterface[]) => void,
  ) => void;
  const system = chrome.system as { network?: { getNetworkInterfaces: GetNetworkInterfaces } } | undefined;
  const getInterfaces = system?.network?.getNetworkInterfaces;
  if (!getInterfaces) return null;

  return new Promise((resolve) => {
    try {
      getInterfaces((interfaces: NetworkInterface[]) => {
        if (chrome.runtime.lastError || !interfaces?.length) {
          resolve(null);
          return;
        }
        for (const iface of interfaces) {
          const prefix = prefixFromIpv4(iface.address);
          if (prefix) {
            resolve(prefix);
            return;
          }
        }
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

/** Best-effort local IPv4 detection via ICE candidates (works on some desktop builds). */
async function getPrefixFromWebRtc(): Promise<string | null> {
  if (typeof RTCPeerConnection === 'undefined') return null;

  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('mochi-cast-probe');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    return await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        pc.close();
        resolve(null);
      }, 2500);

      pc.onicecandidate = (event) => {
        const candidate = event.candidate?.candidate ?? '';
        const match = candidate.match(/(\d+\.\d+\.\d+)\.\d+/);
        if (match) {
          clearTimeout(timeout);
          pc.close();
          resolve(match[1]);
        }
      };
    });
  } catch {
    return null;
  }
}

export async function getLocalSubnetPrefixes(): Promise<string[]> {
  const prefixes: string[] = [];

  const fromSystem = await getPrefixFromChromeSystem();
  if (fromSystem) prefixes.push(fromSystem);

  const fromWebRtc = await getPrefixFromWebRtc();
  if (fromWebRtc && !prefixes.includes(fromWebRtc)) prefixes.push(fromWebRtc);

  for (const prefix of COMMON_SUBNET_PREFIXES) {
    if (!prefixes.includes(prefix)) prefixes.push(prefix);
  }

  return prefixes;
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
    const prefixes = await getLocalSubnetPrefixes();
    for (const prefix of prefixes) {
      const scanned = await scanSubnetForDevices(prefix, extensionFetch, {
        concurrency: 24,
      });
      devices.push(...scanned);
      if (scanned.length > 0) break;
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

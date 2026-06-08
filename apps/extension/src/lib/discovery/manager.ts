import {
  fetchDeviceDescription,
  hostOctetFromIpv4,
  probeDeviceDetailed,
  quickScanSubnetPrefixes,
  reconnectProbeDevice,
  scanSubnetForDevices,
  type DiscoveryTrace,
  type DlnaDevice,
} from '@mochi-cast/dlna-core';
import {
  getLastSavedDevice,
  loadDeviceStore,
  persistDeviceStore,
  saveLastDevice,
  type LastDeviceStatus,
} from '../device-store.js';
import { loadSettings } from '../storage.js';
import {
  createLoggingFetch,
  isDebugEnabled,
  log,
  logError,
  setDebugEnabled,
} from '../debug-log.js';

export type DiscoveryMethod = 'subnet-scan' | 'manual' | 'cached';

export interface DiscoveryResult {
  devices: DlnaDevice[];
  method: DiscoveryMethod;
  error?: string;
  /** Device saved as default after this scan (if any). */
  lastDeviceId?: string;
}

let cachedDevices: DlnaDevice[] = [];

export function getCachedDevices(): DlnaDevice[] {
  return [...cachedDevices];
}

export function setCachedDevices(devices: DlnaDevice[]): void {
  cachedDevices = devices;
  void persistDeviceStore(devices);
}

/** Load devices from chrome.storage when the service worker cache is empty. */
export async function hydrateDevicesFromStorage(): Promise<void> {
  if (cachedDevices.length > 0) return;
  const store = await loadDeviceStore();
  if (store.devices.length > 0) {
    cachedDevices = [...store.devices];
    log('discovery', 'hydrate_from_storage', { count: cachedDevices.length });
  }
}

/** Probe the last-used TV so it is ready before a full subnet scan. */
export async function reconnectLastDevice(): Promise<{
  device: DlnaDevice | null;
  status: LastDeviceStatus;
}> {
  await hydrateDevicesFromStorage();
  const last = await getLastSavedDevice();
  if (!last) {
    return { device: null, status: 'none' };
  }

  log('discovery', 'reconnect_last_start', { name: last.name, ip: last.ip });
  const fetchFn = getExtensionFetch(isDebugEnabled());
  const trace = isDebugEnabled() ? makeTrace('reconnect') : undefined;

  const device = await reconnectProbeDevice(
    { location: last.location, ip: last.ip },
    fetchFn,
    { budgetMs: 4000, dlnaFriendlyName: 'MochiCast', trace },
  );

  if (device) {
    cachedDevices = mergeDevices(cachedDevices, [device]);
    await saveLastDevice(device);
    log('discovery', 'reconnect_last_ok', { name: device.name, ip: device.ip });
    return { device, status: 'online' };
  }

  cachedDevices = mergeDevices(cachedDevices, [last]);
  await persistDeviceStore(cachedDevices, last);
  log('discovery', 'reconnect_last_offline', { ip: last.ip }, 'warn');
  return { device: last, status: 'offline' };
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

/** Common /24 prefixes when automatic detection is unavailable (desktop Chrome hides local IP). */
const COMMON_SUBNET_PREFIXES = [
  '192.168.0',
  '192.168.1',
  '192.168.31',
  '192.168.43',
  '192.168.50',
  '192.168.2',
  '10.0.0',
];

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
  if (!getInterfaces) {
    log('network', 'chrome.system.network unavailable (expected on macOS/Windows)');
    return null;
  }

  return new Promise((resolve) => {
    try {
      getInterfaces((interfaces: NetworkInterface[]) => {
        if (chrome.runtime.lastError) {
          log('network', 'chrome.system.network error', { error: chrome.runtime.lastError.message }, 'warn');
          resolve(null);
          return;
        }
        if (!interfaces?.length) {
          log('network', 'chrome.system.network returned no interfaces');
          resolve(null);
          return;
        }
        log('network', 'chrome.system.network interfaces', {
          count: interfaces.length,
          addresses: interfaces.map((i) => ({ name: i.name, address: i.address })),
        });
        for (const iface of interfaces) {
          const prefix = prefixFromIpv4(iface.address);
          if (prefix) {
            log('network', 'subnet from chrome.system', { prefix, iface: iface.name });
            resolve(prefix);
            return;
          }
        }
        resolve(null);
      });
    } catch (error) {
      logError('network', 'chrome.system.network threw', error);
      resolve(null);
    }
  });
}

const PRIVATE_IPV4_IN_CANDIDATE =
  /(192\.168\.\d+)\.\d+|(10\.\d+\.\d+)\.\d+|(172\.(?:1[6-9]|2\d|3[01])\.\d+)\.\d+/;

function prefixFromCandidate(candidate: string): string | null {
  const match = candidate.match(PRIVATE_IPV4_IN_CANDIDATE);
  if (!match) return null;
  if (match[1]) return match[1];
  if (match[2]) {
    const parts = match[2].split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  if (match[3]) {
    const parts = match[3].split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }
  return null;
}

/** Best-effort local IPv4 detection via ICE candidates (works on some desktop builds). */
async function getPrefixFromWebRtc(): Promise<string | null> {
  if (typeof RTCPeerConnection === 'undefined') {
    log('network', 'RTCPeerConnection not available');
    return null;
  }

  try {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.createDataChannel('mochi-cast-probe');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    log('network', 'WebRTC ICE gathering started');

    return await new Promise<string | null>((resolve) => {
      let settled = false;
      const candidates: string[] = [];
      const finish = (prefix: string | null, reason: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        pc.close();
        log('network', 'WebRTC ICE finished', { reason, prefix, candidates });
        resolve(prefix);
      };

      const timeout = setTimeout(() => finish(null, 'timeout_2s'), 2000);

      const tryCandidate = (candidate: string) => {
        candidates.push(candidate);
        const prefix = prefixFromCandidate(candidate);
        if (prefix) finish(prefix, 'private_ipv4_found');
      };

      pc.onicecandidate = (event) => {
        if (event.candidate?.candidate) tryCandidate(event.candidate.candidate);
      };
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') finish(null, 'gathering_complete_no_ipv4');
      };
    });
  } catch (error) {
    logError('network', 'WebRTC subnet detection failed', error);
    return null;
  }
}

export async function getPrioritizedSubnetPrefixes(options?: {
  customSubnet?: string;
  lastDeviceIp?: string;
}): Promise<{ prefixes: string[]; primary: string | null }> {
  const prefixes: string[] = [];
  const sources: Record<string, string | null | undefined> = {};

  const add = (prefix: string | null | undefined, source: string) => {
    if (!prefix || prefixes.includes(prefix)) return;
    prefixes.push(prefix);
    sources[source] = prefix;
  };

  if (options?.lastDeviceIp) {
    add(prefixFromIpv4(options.lastDeviceIp), 'lastDevice');
  }

  const custom = options?.customSubnet?.trim().replace(/\.+$/, '');
  if (custom) add(custom, 'settings');

  const fromSystem = await getPrefixFromChromeSystem();
  add(fromSystem, 'chromeSystem');

  const hasKnownPrefix = prefixes.length > 0;
  if (!hasKnownPrefix) {
    const fromWebRtc = await getPrefixFromWebRtc();
    add(fromWebRtc, 'webrtc');
  } else {
    log('network', 'WebRTC skipped (prefix already known)', { prefixes });
  }

  for (const prefix of COMMON_SUBNET_PREFIXES) {
    add(prefix, 'common');
  }

  log('network', 'subnet prefix list', { sources, prefixes });
  return { prefixes, primary: prefixes[0] ?? null };
}

/** @deprecated Use getPrioritizedSubnetPrefixes */
export async function getLocalSubnetPrefixes(): Promise<string[]> {
  const { prefixes } = await getPrioritizedSubnetPrefixes();
  return prefixes;
}

function makeTrace(scope: string): DiscoveryTrace {
  return (event: string, detail?: Record<string, unknown>) => {
    log(scope, event, detail, 'debug');
  };
}

let loggingFetch: typeof fetch | undefined;

function getExtensionFetch(debug: boolean): typeof fetch {
  if (!debug) return extensionFetch;
  if (!loggingFetch) {
    loggingFetch = createLoggingFetch('fetch', extensionFetch);
  }
  return loggingFetch;
}

export async function discoverDevices(options: {
  timeoutMs?: number;
  manualIps?: string[];
  includeSubnetScan?: boolean;
  debug?: boolean;
}): Promise<DiscoveryResult> {
  setDebugEnabled(Boolean(options.debug));
  const manualIps = options.manualIps ?? [];
  const timeoutMs = options.timeoutMs ?? 20_000;
  const deadline = Date.now() + timeoutMs;
  const devices: DlnaDevice[] = [];
  const sessionId = `${Date.now()}`;
  const fetchFn = getExtensionFetch(Boolean(options.debug));
  const trace = options.debug ? makeTrace('probe') : undefined;

  log('discovery', 'session_start', {
    sessionId,
    timeoutMs,
    manualIps,
    includeSubnetScan: options.includeSubnetScan !== false,
    cachedCount: cachedDevices.length,
  });

  if (manualIps.length > 0) {
    log('discovery', 'manual_probe_start', { ips: manualIps });
    const manualResults = await Promise.all(
      manualIps.map(async (ip) => {
        const { device } = await probeDeviceDetailed(ip, fetchFn, {
          timeoutMs: 4000,
          trace,
          tryAlternatePorts: true,
          dlnaFriendlyName: 'MochiCast',
        });
        log('discovery', device ? 'manual_probe_hit' : 'manual_probe_miss', { ip, device: device?.name });
        return device;
      }),
    );
    for (const device of manualResults) {
      if (device) devices.push(device);
    }
    log('discovery', 'manual_probe_done', { found: devices.length });
  }

  if (options.includeSubnetScan !== false && Date.now() < deadline) {
    const settings = await loadSettings();
    const last = await getLastSavedDevice();
    const { prefixes, primary } = await getPrioritizedSubnetPrefixes({
      customSubnet: settings.subnetPrefix,
      lastDeviceIp: last?.ip,
    });
    const priorityHosts = [
      last?.ip ? hostOctetFromIpv4(last.ip) : null,
      ...settings.manualDevices.map((d) => hostOctetFromIpv4(d.ip)),
    ].filter((h): h is number => h != null);

    log('discovery', 'subnet_scan_start', {
      prefixes,
      primary,
      priorityHosts,
      remainingMs: deadline - Date.now(),
      mode: 'quick_multi_then_primary_full',
    });

    if (last?.ip && Date.now() < deadline) {
      const direct = await probeDeviceDetailed(last.ip, fetchFn, {
        timeoutMs: Math.min(5000, deadline - Date.now()),
        tryAlternatePorts: true,
        trace,
        dlnaFriendlyName: 'MochiCast',
      });
      if (direct.device) {
        devices.push(direct.device);
        log('discovery', 'last_ip_direct_hit', { ip: last.ip, name: direct.device.name });
      }
    }

    if (devices.length === 0 && Date.now() < deadline) {
      const quickFound = await quickScanSubnetPrefixes(prefixes, fetchFn, {
        maxPrefixes: 4,
        deadline,
        concurrency: 48,
        probeTimeoutMs: 1500,
        tryAlternatePorts: true,
        priorityHosts,
        trace,
        dlnaFriendlyName: 'MochiCast',
      });
      devices.push(...quickFound);
      if (quickFound.length > 0) {
        log('discovery', 'quick_multi_prefix_hit', {
          count: quickFound.length,
          ips: quickFound.map((d) => d.ip),
        });
      }
    }

    if (devices.length === 0 && primary && Date.now() < deadline) {
      const scanned = await scanSubnetForDevices(primary, fetchFn, {
        concurrency: 40,
        deadline,
        probeTimeoutMs: 1200,
        tryAlternatePorts: true,
        priorityHosts,
        trace,
        dlnaFriendlyName: 'MochiCast',
      });
      devices.push(...scanned);
      if (scanned.length > 0) {
        log('discovery', 'primary_subnet_full_hit', { prefix: primary, found: scanned.length });
      }
    }

    if (devices.length === 0 && Date.now() < deadline) {
      for (const prefix of prefixes) {
        if (prefix === primary || Date.now() >= deadline) continue;
        const scanned = await scanSubnetForDevices(prefix, fetchFn, {
          concurrency: 32,
          deadline,
          probeTimeoutMs: 1000,
          tryAlternatePorts: false,
          priorityHosts,
          trace,
          dlnaFriendlyName: 'MochiCast',
        });
        devices.push(...scanned);
        if (scanned.length > 0) {
          log('discovery', 'secondary_subnet_hit', { prefix, found: scanned.length });
          break;
        }
      }
    }

    log('discovery', 'subnet_scan_done', { found: devices.length });
  } else if (options.includeSubnetScan === false) {
    log('discovery', 'subnet_scan_skipped', { reason: 'includeSubnetScan=false' });
  } else {
    log('discovery', 'subnet_scan_skipped', { reason: 'deadline_before_scan' });
  }

  const merged = mergeDevices(cachedDevices, devices);
  cachedDevices = merged;
  await persistDeviceStore(merged);

  let lastDeviceId: string | undefined;
  if (merged.length > 0) {
    const settings = await loadSettings();
    let preferred = merged[0];
    if (settings.lastDeviceId) {
      const existing = merged.find((d) => d.id === settings.lastDeviceId);
      if (existing) preferred = existing;
    }
    await saveLastDevice(preferred);
    lastDeviceId = preferred.id;
    log('discovery', 'saved_last_device', { id: lastDeviceId, name: preferred.name, ip: preferred.ip });
  }

  const result: DiscoveryResult = {
    devices: merged,
    method: manualIps.length > 0 ? 'manual' : 'subnet-scan',
    error: merged.length === 0 ? 'no_devices_found' : undefined,
    lastDeviceId,
  };

  log('discovery', 'session_end', {
    sessionId,
    newFound: devices.length,
    mergedCount: merged.length,
    error: result.error,
    devices: merged.map((d) => ({ name: d.name, ip: d.ip, location: d.location })),
  });

  return result;
}

export async function addDeviceByIp(
  ip: string,
  name?: string,
): Promise<{ device: DlnaDevice | null; error?: string }> {
  const fetchFn = getExtensionFetch(isDebugEnabled());
  const trace = isDebugEnabled() ? makeTrace('manual') : undefined;
  log('discovery', 'add_device_by_ip', { ip, name });
  const result = await probeDeviceDetailed(ip.trim(), fetchFn, {
    timeoutMs: 5000,
    trace,
    tryAlternatePorts: true,
    dlnaFriendlyName: 'MochiCast',
  });
  if (!result.device) {
    log('discovery', 'add_device_by_ip_failed', { ip, summary: result.summary, attempts: result.attempts.length }, 'warn');
    return { device: null, error: result.summary ?? 'Device not found at IP' };
  }
  const device = result.device;
  if (name) device.name = name;
  cachedDevices = mergeDevices(cachedDevices, [device]);
  await saveLastDevice(device);
  log('discovery', 'add_device_by_ip_ok', { ip, device: device.name });
  return { device };
}

export async function resolveDeviceFromManual(
  manual: { ip: string; name?: string; location?: string },
): Promise<DlnaDevice | null> {
  log('discovery', 'resolve_manual', manual);
  if (manual.location) {
    const fetchFn = getExtensionFetch(isDebugEnabled());
    const device = await fetchDeviceDescription(manual.location, fetchFn);
    if (device) {
      log('discovery', 'resolve_manual_location_ok', { location: manual.location });
      return device;
    }
    log('discovery', 'resolve_manual_location_failed', { location: manual.location }, 'warn');
  }
  const { device } = await addDeviceByIp(manual.ip, manual.name);
  return device;
}

/** Extension fetch bypasses page CORS for LAN device communication */
async function extensionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const merged: RequestInit & { targetAddressSpace?: string } = {
    ...init,
    targetAddressSpace: 'local',
  };
  return fetch(input, merged);
}

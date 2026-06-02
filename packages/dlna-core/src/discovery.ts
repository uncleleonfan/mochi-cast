import {
  AV_TRANSPORT_SERVICE,
  DEFAULT_SEARCH_TARGET,
  RENDERING_CONTROL_SERVICE,
  SSDP_MULTICAST_ADDRESS,
  SSDP_PORT,
  type DiscoveryOptions,
  type DlnaDevice,
  type SsdpResponse,
  type UdpTransport,
} from './types.js';

const CRLF = '\r\n';

export function buildMSearch(searchTarget = DEFAULT_SEARCH_TARGET, mx = 3): string {
  return [
    'M-SEARCH * HTTP/1.1',
    `HOST: ${SSDP_MULTICAST_ADDRESS}:${SSDP_PORT}`,
    'MAN: "ssdp:discover"',
    `MX: ${mx}`,
    `ST: ${searchTarget}`,
    '',
    '',
  ].join(CRLF);
}

export function parseSsdpResponse(raw: string): SsdpResponse | null {
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return null;

  const statusLine = lines[0];
  if (!statusLine.includes('200')) return null;

  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const colon = lines[i].indexOf(':');
    if (colon === -1) continue;
    const key = lines[i].slice(0, colon).trim().toLowerCase();
    const value = lines[i].slice(colon + 1).trim();
    headers[key] = value;
  }

  const location = headers.location;
  const usn = headers.usn ?? headers['unique-service-name'] ?? location;
  if (!location || !usn) return null;

  return {
    usn,
    location,
    server: headers.server,
    st: headers.st,
    headers,
  };
}

function extractIpFromLocation(location: string): string {
  try {
    return new URL(location).hostname;
  } catch {
    const match = location.match(/https?:\/\/([^:/]+)/);
    return match?.[1] ?? location;
  }
}

function isMediaRenderer(response: SsdpResponse): boolean {
  const st = (response.st ?? '').toLowerCase();
  const usn = response.usn.toLowerCase();
  return (
    st.includes('mediarenderer') ||
    usn.includes('mediarenderer') ||
    st === 'upnp:rootdevice'
  );
}

export async function discoverViaSsdp(
  udpTransport: UdpTransport,
  options: DiscoveryOptions = {},
): Promise<DlnaDevice[]> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const searchTarget = options.searchTarget ?? DEFAULT_SEARCH_TARGET;
  const responses = new Map<string, SsdpResponse>();

  const cleanup = await udpTransport.listen(0, (data) => {
    const parsed = parseSsdpResponse(data);
    if (!parsed) return;
    if (!isMediaRenderer(parsed)) return;
    responses.set(parsed.usn, parsed);
  });

  try {
    await udpTransport.send(buildMSearch(searchTarget), SSDP_MULTICAST_ADDRESS, SSDP_PORT);
    await sleep(timeoutMs);
  } finally {
    await cleanup();
  }

  return Array.from(responses.values()).map((response) => ({
    id: response.usn,
    name: response.server ?? extractIpFromLocation(response.location),
    ip: extractIpFromLocation(response.location),
    location: response.location,
  }));
}

export const COMMON_DESCRIPTION_PATHS = [
  '/description.xml',
  '/dmr/description.xml',
  '/rootDesc.xml',
  '/MediaRenderer/desc.xml',
  '/upnp/dev/desc.xml',
];

export async function probeDeviceAtIp(
  ip: string,
  fetchFn: typeof fetch = fetch,
): Promise<DlnaDevice | null> {
  for (const path of COMMON_DESCRIPTION_PATHS) {
    const location = `http://${ip}${path}`;
    try {
      const response = await fetchFn(location, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) continue;
      const xml = await response.text();
      if (!xml.includes('MediaRenderer') && !xml.includes('AVTransport')) continue;
      const device = parseDeviceDescription(xml, location);
      if (device) return device;
    } catch {
      // try next path
    }
  }
  return null;
}

export async function scanSubnetForDevices(
  subnetPrefix: string,
  fetchFn: typeof fetch = fetch,
  options: { start?: number; end?: number; concurrency?: number } = {},
): Promise<DlnaDevice[]> {
  const start = options.start ?? 1;
  const end = options.end ?? 254;
  const concurrency = options.concurrency ?? 20;
  const devices: DlnaDevice[] = [];
  const ips: string[] = [];

  for (let i = start; i <= end; i++) {
    ips.push(`${subnetPrefix}.${i}`);
  }

  for (let i = 0; i < ips.length; i += concurrency) {
    const batch = ips.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((ip) => probeDeviceAtIp(ip, fetchFn)),
    );
    for (const device of results) {
      if (device) devices.push(device);
    }
  }

  return devices;
}

export function parseDeviceDescription(xml: string, location: string): DlnaDevice | null {
  const friendlyName = extractTag(xml, 'friendlyName');
  const manufacturer = extractTag(xml, 'manufacturer');
  const model = extractTag(xml, 'modelName') ?? extractTag(xml, 'modelNumber');
  const ip = extractIpFromLocation(location);

  const avTransportUrl = findServiceControlUrl(xml, AV_TRANSPORT_SERVICE, location);
  const renderingControlUrl = findServiceControlUrl(
    xml,
    RENDERING_CONTROL_SERVICE,
    location,
  );

  if (!avTransportUrl) return null;

  return {
    id: location,
    name: friendlyName ?? manufacturer ?? ip,
    friendlyName,
    manufacturer,
    model,
    ip,
    location,
    avTransportUrl,
    renderingControlUrl,
  };
}

function findServiceControlUrl(
  xml: string,
  serviceType: string,
  location: string,
): string | undefined {
  const serviceBlocks = xml.match(/<service[\s\S]*?<\/service>/gi) ?? [];
  for (const block of serviceBlocks) {
    if (!block.includes(serviceType)) continue;
    const controlPath = extractTag(block, 'controlURL');
    if (controlPath) return resolveUrl(location, controlPath);
  }
  return undefined;
}

function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match?.[1]?.trim();
}

export function resolveUrl(base: string, path: string): string {
  try {
    return new URL(path, base).href;
  } catch {
    return path;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

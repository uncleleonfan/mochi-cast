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
  '/xml/device.xml',
  '/DeviceDescription.xml',
];

/** Ports used by DLNA renderers when not on :80 (LOCATION from SSDP often uses these). */
export const COMMON_PROBE_PORTS = [
  undefined,
  49152,
  49153,
  8080,
  8008,
  7676,
  6095,
  52307,
  1080,
] as const;

/** Fewer ports during subnet scan to stay within time budget. */
export const FAST_PROBE_PORTS = [undefined, 49152, 8080] as const;

/** Host octets probed first — many TVs use high DHCP addresses. */
export const QUICK_PROBE_HOSTS = [1, 2, 100, 101, 102, 150, 200, 254];

export type DiscoveryTrace = (event: string, detail?: Record<string, unknown>) => void;

export interface ProbeAttempt {
  url: string;
  result: 'found' | 'http_error' | 'not_renderer' | 'no_avtransport' | 'network_error';
  status?: number;
  detail?: string;
}

export interface ProbeResult {
  device: DlnaDevice | null;
  attempts: ProbeAttempt[];
  summary?: string;
}

/** HTTP header sets tried in order (many TVs reject Chrome’s default User-Agent with 403). */
export const PROBE_HTTP_PROFILES: ReadonlyArray<Record<string, string>> = [
  {
    Accept: 'text/xml, application/xml, */*',
    'User-Agent': 'Mozilla/5.0 (compatible; UPnP/1.0; DLNADOC/1.50)',
    Connection: 'close',
  },
  {
    Accept: 'text/xml, application/xml',
    'User-Agent': 'Microsoft-Windows/10.0 UPnP/1.0 Microsoft-DLNA DLNADOC/1.50',
    Connection: 'close',
  },
  {
    Accept: '*/*',
    'User-Agent': 'DLNADOC/1.50 UPnP/1.0',
  },
];

export interface ProbeOptions {
  timeoutMs?: number;
  paths?: string[];
  /** Try common alternate ports (default true for manual IP, false for subnet scan). */
  tryAlternatePorts?: boolean;
  /** Sent as friendlyname.dlna.org on some Samsung / Microsoft renderers. */
  dlnaFriendlyName?: string;
  /** Optional callback for debug logging (extension passes when debug is on). */
  trace?: DiscoveryTrace;
}

export interface NormalizedProbeTarget {
  host: string;
  /** Full description URLs to try first (user pasted LOCATION). */
  directLocations: string[];
  origins: string[];
}

export interface SubnetScanOptions {
  start?: number;
  end?: number;
  concurrency?: number;
  /** Absolute timestamp (ms); stop scanning when reached. */
  deadline?: number;
  probeTimeoutMs?: number;
  /** When true, probe COMMON_PROBE_PORTS (49152, 8080, …) like manual IP add. */
  tryAlternatePorts?: boolean;
  dlnaFriendlyName?: string;
  trace?: DiscoveryTrace;
}

/** Parse user input: plain IP, IP:port, or full http(s) description URL. */
export function normalizeProbeTarget(input: string): NormalizedProbeTarget {
  const trimmed = input.trim();
  const directLocations: string[] = [];

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      directLocations.push(url.href);
      const host = url.hostname;
      const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
      return {
        host,
        directLocations,
        origins: buildProbeOrigins(host, port, COMMON_PROBE_PORTS),
      };
    } catch {
      // fall through
    }
  }

  const withoutPath = trimmed.split('/')[0] ?? trimmed;
  const [hostPart, portPart] = withoutPath.split(':');
  const host = hostPart.replace(/^https?:\/\//i, '');
  const hintPort = portPart ? Number(portPart) : undefined;

  return {
    host,
    directLocations,
    origins: buildProbeOrigins(host, hintPort, COMMON_PROBE_PORTS),
  };
}

export function buildProbeOrigins(
  host: string,
  hintPort?: number,
  ports: readonly (number | undefined)[] = COMMON_PROBE_PORTS,
): string[] {
  const seen = new Set<string>();
  const add = (origin: string) => {
    if (!seen.has(origin)) seen.add(origin);
  };

  if (hintPort !== undefined && !Number.isNaN(hintPort)) {
    add(`http://${host}:${hintPort}`);
  }
  for (const port of ports) {
    if (port === undefined) add(`http://${host}`);
    else add(`http://${host}:${port}`);
  }
  return [...seen];
}

function lanFetchInit(
  timeoutMs: number,
  headers: Record<string, string>,
): RequestInit {
  return {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
    headers,
    targetAddressSpace: 'local',
  } as RequestInit & { targetAddressSpace: string };
}

function buildProbeHeaderProfiles(dlnaFriendlyName?: string): Record<string, string>[] {
  const profiles = PROBE_HTTP_PROFILES.map((p) => ({ ...p }));
  if (dlnaFriendlyName) {
    profiles.push({
      Accept: 'text/xml, application/xml',
      'User-Agent': 'Microsoft-Windows/10.0 UPnP/1.0 Microsoft-DLNA DLNADOC/1.50',
      'friendlyname.dlna.org': dlnaFriendlyName.slice(0, 64),
      Connection: 'close',
    });
  }
  return profiles;
}

async function fetchDescriptionXml(
  location: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
  trace?: DiscoveryTrace,
  dlnaFriendlyName?: string,
): Promise<{ xml: string; finalLocation: string } | ProbeAttempt> {
  const profiles = buildProbeHeaderProfiles(dlnaFriendlyName);
  let lastHttp: ProbeAttempt | undefined;

  for (let i = 0; i < profiles.length; i++) {
    const headers = profiles[i];
    try {
      const response = await fetchFn(location, lanFetchInit(timeoutMs, headers));
      const xml = await response.text();

      if (response.ok) {
        return { xml, finalLocation: location };
      }

      if ((response.status === 403 || response.status === 401) && looksLikeUpnpDevice(xml)) {
        trace?.('probe_http_forbidden_but_xml', {
          url: location,
          status: response.status,
          profile: i,
        });
        return { xml, finalLocation: location };
      }

      lastHttp = {
        url: location,
        result: 'http_error',
        status: response.status,
        detail: `HTTP ${response.status} (profile ${i})`,
      };
      trace?.('probe_http_status', {
        url: location,
        status: response.status,
        profile: i,
        userAgent: headers['User-Agent'],
      });

      if (response.status !== 403 && response.status !== 401) {
        return lastHttp;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      trace?.('probe_error', { url: location, error: detail, profile: i });
      return { url: location, result: 'network_error', detail };
    }
  }

  return (
    lastHttp ?? {
      url: location,
      result: 'http_error',
      detail: 'All HTTP profiles failed',
    }
  );
}

function tryParseDescription(
  xml: string,
  location: string,
  trace?: DiscoveryTrace,
): { device: DlnaDevice } | ProbeAttempt {
  if (!looksLikeUpnpDevice(xml)) {
    trace?.('probe_not_renderer', { url: location, bytes: xml.length });
    return {
      url: location,
      result: 'not_renderer',
      detail: 'Response is not UPnP device XML',
    };
  }
  const device = parseDeviceDescription(xml, location);
  if (!device) {
    trace?.('probe_no_avtransport', { url: location });
    return {
      url: location,
      result: 'no_avtransport',
      detail: 'No AVTransport control URL in device description',
    };
  }
  trace?.('probe_found', {
    url: location,
    name: device.name,
    avTransportUrl: device.avTransportUrl,
  });
  return { device };
}

export async function probeDeviceAtIp(
  ip: string,
  fetchFn: typeof fetch = fetch,
  options: ProbeOptions = {},
): Promise<DlnaDevice | null> {
  return (await probeDeviceDetailed(ip, fetchFn, options)).device;
}

export async function probeDeviceDetailed(
  ip: string,
  fetchFn: typeof fetch = fetch,
  options: ProbeOptions = {},
): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? 1200;
  const paths = options.paths ?? COMMON_DESCRIPTION_PATHS;
  const trace = options.trace;
  const attempts: ProbeAttempt[] = [];
  const target = normalizeProbeTarget(ip);
  const ports = options.tryAlternatePorts === false ? FAST_PROBE_PORTS : COMMON_PROBE_PORTS;
  const origins =
    options.tryAlternatePorts === false
      ? buildProbeOrigins(target.host, undefined, ports)
      : target.origins;

  const locations: string[] = [...target.directLocations];
  for (const origin of origins) {
    for (const path of paths) {
      locations.push(`${origin.replace(/\/$/, '')}${path}`);
    }
  }

  trace?.('probe_start', {
    input: ip,
    host: target.host,
    locationCount: locations.length,
    tryAlternatePorts: options.tryAlternatePorts !== false,
  });

  for (const location of locations) {
    const fetched = await fetchDescriptionXml(
      location,
      fetchFn,
      timeoutMs,
      trace,
      options.dlnaFriendlyName,
    );
    if ('result' in fetched) {
      attempts.push(fetched);
      continue;
    }

    const parsed = tryParseDescription(fetched.xml, fetched.finalLocation, trace);
    if ('device' in parsed) {
      attempts.push({ url: location, result: 'found' });
      return { device: parsed.device, attempts };
    }
    attempts.push(parsed);
  }

  const summary = summarizeProbeFailures(attempts);
  trace?.('probe_give_up', { host: target.host, summary, attemptCount: attempts.length });
  return { device: null, attempts, summary };
}

const RECONNECT_DESCRIPTION_PATHS = ['/description.xml', '/dmr/description.xml'] as const;

/** Build a small ordered URL list for reconnecting to a previously saved TV. */
export function buildReconnectProbeUrls(last: {
  location?: string;
  ip: string;
}): string[] {
  const urls: string[] = [];
  const location = last.location?.trim();
  if (location) urls.push(location);

  const ip = last.ip.trim();
  if (!ip) return [...new Set(urls)];

  for (const path of RECONNECT_DESCRIPTION_PATHS) {
    urls.push(`http://${ip}${path}`);
  }

  if (location) {
    try {
      const parsed = new URL(location);
      const port = parsed.port ? Number(parsed.port) : undefined;
      if (port && port !== 80) {
        for (const path of RECONNECT_DESCRIPTION_PATHS) {
          urls.push(`http://${ip}:${port}${path}`);
        }
      }
    } catch {
      /* ignore invalid saved location */
    }
  }

  for (const path of RECONNECT_DESCRIPTION_PATHS) {
    urls.push(`http://${ip}:49152${path}`);
  }

  return [...new Set(urls)];
}

/**
 * Fast probe for popup reopen — bounded time, few URLs (not full port/path scan).
 */
export async function reconnectProbeDevice(
  last: { location?: string; ip: string },
  fetchFn: typeof fetch = fetch,
  options: { budgetMs?: number; dlnaFriendlyName?: string; trace?: DiscoveryTrace } = {},
): Promise<DlnaDevice | null> {
  const deadline = Date.now() + (options.budgetMs ?? 4000);
  const urls = buildReconnectProbeUrls(last);
  options.trace?.('reconnect_probe_start', { urlCount: urls.length, budgetMs: options.budgetMs ?? 4000 });

  for (const url of urls) {
    const remaining = deadline - Date.now();
    if (remaining < 200) break;

    const fetched = await fetchDescriptionXml(
      url,
      fetchFn,
      Math.min(1500, remaining),
      options.trace,
      options.dlnaFriendlyName,
    );
    if ('result' in fetched) continue;

    const parsed = tryParseDescription(fetched.xml, fetched.finalLocation, options.trace);
    if ('device' in parsed) {
      options.trace?.('reconnect_probe_ok', { url, name: parsed.device.name });
      return parsed.device;
    }
  }

  options.trace?.('reconnect_probe_miss', { ip: last.ip });
  return null;
}

function summarizeProbeFailures(attempts: ProbeAttempt[]): string {
  if (attempts.length === 0) return 'No probe attempts made';
  const network = attempts.filter((a) => a.result === 'network_error');
  const http = attempts.filter((a) => a.result === 'http_error');
  const noAv = attempts.filter((a) => a.result === 'no_avtransport');
  const notRenderer = attempts.filter((a) => a.result === 'not_renderer');

  if (network.length === attempts.length) {
    return `Cannot reach TV (${network[0]?.detail ?? 'connection failed'}). Same Wi-Fi? DLNA on? Try pasting the full description URL from your TV.`;
  }
  const forbidden = http.filter((a) => a.status === 403 || a.status === 401);
  if (forbidden.length > 0 && forbidden.length >= http.length * 0.5) {
    const sample = forbidden[0]?.url ?? '';
    return (
      'TV returned HTTP 403 (blocked this client). On the TV: enable DLNA / wireless casting, ' +
      'restart the TV, or remove old cast pairings. ' +
      `If your TV shows a description URL in its network settings, paste that full URL here. ` +
      (sample ? `Last blocked: ${sample}` : '')
    );
  }
  if (noAv.length > 0) {
    return 'TV responded but is not a DLNA MediaRenderer (or uses an unsupported layout).';
  }
  if (notRenderer.length > 0 && http.length === 0) {
    return 'Host responded but no UPnP MediaRenderer description found on common paths/ports.';
  }
  if (http.length > 0) {
    return `No DLNA description on tried URLs (e.g. HTTP ${http[0]?.status ?? 'error'}). Enable wireless casting on the TV and confirm the IP.`;
  }
  return 'No DLNA device found at this address.';
}

function looksLikeUpnpDevice(xml: string): boolean {
  const lower = xml.toLowerCase();
  return (
    lower.includes('mediarenderer') ||
    lower.includes('avtransport') ||
    lower.includes('urn:schemas-upnp-org:device')
  );
}

export async function scanSubnetForDevices(
  subnetPrefix: string,
  fetchFn: typeof fetch = fetch,
  options: SubnetScanOptions = {},
): Promise<DlnaDevice[]> {
  const start = options.start ?? 1;
  const end = options.end ?? 254;
  const concurrency = options.concurrency ?? 32;
  const deadline = options.deadline;
  const probeTimeoutMs = options.probeTimeoutMs ?? 1200;
  const trace = options.trace;
  const devices: DlnaDevice[] = [];
  const seenIds = new Set<string>();
  const scanStarted = Date.now();

  const isExpired = () => deadline !== undefined && Date.now() >= deadline;

  trace?.('subnet_scan_start', {
    prefix: subnetPrefix,
    start,
    end,
    concurrency,
    deadlineMs: deadline ? deadline - scanStarted : undefined,
  });

  const record = (device: DlnaDevice | null) => {
    if (!device || seenIds.has(device.id)) return;
    seenIds.add(device.id);
    devices.push(device);
  };

  const runBatch = async (phase: 'quick' | 'full', hostOctets: number[]) => {
    if (isExpired() || hostOctets.length === 0) return;
    trace?.('subnet_batch_start', { prefix: subnetPrefix, phase, hosts: hostOctets.length });
    const batchTrace: DiscoveryTrace | undefined =
      trace &&
      ((event, detail) => {
        if (phase === 'full' && event === 'probe_error') return;
        trace(event, detail);
      });
    for (let i = 0; i < hostOctets.length; i += concurrency) {
      if (isExpired()) {
        trace?.('subnet_scan_deadline', { prefix: subnetPrefix, phase, found: devices.length });
        return;
      }
      const batch = hostOctets.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map((host) =>
          probeDeviceAtIp(`${subnetPrefix}.${host}`, fetchFn, {
            timeoutMs: probeTimeoutMs,
            trace: batchTrace,
            tryAlternatePorts: options.tryAlternatePorts ?? false,
            dlnaFriendlyName: options.dlnaFriendlyName,
          }),
        ),
      );
      for (const device of results) record(device);
    }
  };

  const quickHosts = QUICK_PROBE_HOSTS.filter((h) => h >= start && h <= end);
  await runBatch('quick', quickHosts);

  const remaining: number[] = [];
  for (let host = start; host <= end; host++) {
    if (!quickHosts.includes(host)) remaining.push(host);
  }
  await runBatch('full', remaining);

  trace?.('subnet_scan_done', {
    prefix: subnetPrefix,
    found: devices.length,
    ms: Date.now() - scanStarted,
    names: devices.map((d) => d.name),
  });

  return devices;
}

export function parseDeviceDescription(xml: string, location: string): DlnaDevice | null {
  const urlBase = extractTag(xml, 'URLBase');
  const base = urlBase ? resolveUrl(location, urlBase) : location;

  const deviceBlocks = xml.match(/<device[\s\S]*?<\/device>/gi) ?? [xml];
  const rendererBlocks = deviceBlocks.filter((b) => /mediarenderer/i.test(b));

  for (const block of rendererBlocks.length > 0 ? rendererBlocks : deviceBlocks) {
    const parsed = parseRendererBlock(block, base);
    if (parsed) return parsed;
  }

  return parseRendererBlock(xml, base);
}

function parseRendererBlock(xml: string, base: string): DlnaDevice | null {
  if (!/mediarenderer|avtransport/i.test(xml)) return null;

  const friendlyName = extractTag(xml, 'friendlyName');
  const manufacturer = extractTag(xml, 'manufacturer');
  const model = extractTag(xml, 'modelName') ?? extractTag(xml, 'modelNumber');
  const ip = extractIpFromLocation(base);

  const avTransportUrl =
    findServiceControlUrl(xml, AV_TRANSPORT_SERVICE, base) ??
    findServiceControlUrl(xml, 'AVTransport', base);
  const renderingControlUrl =
    findServiceControlUrl(xml, RENDERING_CONTROL_SERVICE, base) ??
    findServiceControlUrl(xml, 'RenderingControl', base);

  if (!avTransportUrl) return null;

  return {
    id: base,
    name: friendlyName ?? manufacturer ?? ip,
    friendlyName,
    manufacturer,
    model,
    ip,
    location: base,
    avTransportUrl,
    renderingControlUrl,
  };
}

function findServiceControlUrl(
  xml: string,
  serviceType: string,
  location: string,
): string | undefined {
  const needle = serviceType.toLowerCase();
  const serviceBlocks = xml.match(/<service[\s\S]*?<\/service>/gi) ?? [];
  for (const block of serviceBlocks) {
    if (!block.toLowerCase().includes(needle)) continue;
    const controlPath =
      extractTag(block, 'controlURL') ?? extractTag(block, 'controlUrl');
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

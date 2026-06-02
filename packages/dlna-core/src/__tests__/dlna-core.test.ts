import { describe, expect, it, vi } from 'vitest';
import {
  buildDidlLiteMetadata,
  buildMSearch,
  buildSoapEnvelope,
  guessMimeType,
  parseDeviceDescription,
  parseSsdpResponse,
  buildReconnectProbeUrls,
  probeDeviceAtIp,
  reconnectProbeDevice,
  resolveUrl,
  scanSubnetForDevices,
} from '../index.js';

describe('SSDP', () => {
  it('builds M-SEARCH request', () => {
    const message = buildMSearch();
    expect(message).toContain('M-SEARCH * HTTP/1.1');
    expect(message).toContain('239.255.255.250:1900');
    expect(message).toContain('MediaRenderer:1');
  });

  it('parses SSDP response', () => {
    const raw = [
      'HTTP/1.1 200 OK',
      'CACHE-CONTROL: max-age=1800',
      'LOCATION: http://192.168.1.100:49152/description.xml',
      'SERVER: Linux/3.0 UPnP/1.0',
      'ST: urn:schemas-upnp-org:device:MediaRenderer:1',
      'USN: uuid:abc::urn:schemas-upnp-org:device:MediaRenderer:1',
    ].join('\r\n');

    const parsed = parseSsdpResponse(raw);
    expect(parsed?.location).toBe('http://192.168.1.100:49152/description.xml');
    expect(parsed?.usn).toContain('MediaRenderer');
  });
});

describe('Reconnect probe', () => {
  it('builds a small URL list from saved device', () => {
    const urls = buildReconnectProbeUrls({
      location: 'http://192.168.1.100:49152/description.xml',
      ip: '192.168.1.100',
    });
    expect(urls[0]).toBe('http://192.168.1.100:49152/description.xml');
    expect(urls).toContain('http://192.168.1.100/description.xml');
    expect(urls.length).toBeLessThan(12);
  });

  it('stops after budgetMs even when fetch is slow', async () => {
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const started = Date.now();
    const device = await reconnectProbeDevice(
      { ip: '192.168.1.99', location: 'http://192.168.1.99:49152/description.xml' },
      fetchFn,
      { budgetMs: 600 },
    );
    expect(device).toBeNull();
    expect(Date.now() - started).toBeLessThan(2500);
  });
});

describe('Subnet scan', () => {
  it('stops probing when deadline is reached', async () => {
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    const started = Date.now();
    const devices = await scanSubnetForDevices('192.168.99', fetchFn, {
      start: 1,
      end: 20,
      concurrency: 5,
      deadline: started + 500,
      probeTimeoutMs: 200,
    });
    const elapsed = Date.now() - started;
    expect(devices).toEqual([]);
    expect(elapsed).toBeLessThan(8000);
    expect(fetchFn.mock.calls.length).toBeGreaterThan(0);
    expect(fetchFn.mock.calls.length).toBeLessThan(200);
  });

  it('probes until description.xml succeeds', async () => {
    const paths: string[] = [];
    const fetchFn = vi.fn(async (url: string) => {
      paths.push(url);
      if (url.endsWith('/description.xml') && url.startsWith('http://192.168.1.50')) {
        return new Response(sampleRendererXml, { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    const device = await probeDeviceAtIp('192.168.1.50', fetchFn, {
      timeoutMs: 200,
      tryAlternatePorts: false,
    });
    expect(device?.name).toBe('Living Room TV');
    expect(paths.some((p) => p.includes('/description.xml'))).toBe(true);
  });
});

const sampleRendererXml = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <device>
    <deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType>
    <friendlyName>Living Room TV</friendlyName>
    <serviceList>
      <service>
        <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
        <controlURL>/AVTransport/control</controlURL>
      </service>
    </serviceList>
  </device>
</root>`;

describe('Device description', () => {
  const sampleXml = `<?xml version="1.0"?>
<root xmlns="urn:schemas-upnp-org:device-1-0">
  <device>
    <deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType>
    <friendlyName>Living Room TV</friendlyName>
    <manufacturer>Xiaomi</manufacturer>
    <modelName>Mi TV</modelName>
    <serviceList>
      <service>
        <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
        <controlURL>/AVTransport/control</controlURL>
      </service>
      <service>
        <serviceType>urn:schemas-upnp-org:service:RenderingControl:1</serviceType>
        <controlURL>/RenderingControl/control</controlURL>
      </service>
    </serviceList>
  </device>
</root>`;

  it('parses MediaRenderer device', () => {
    const location = 'http://192.168.1.100:8080/description.xml';
    const device = parseDeviceDescription(sampleXml, location);
    expect(device?.name).toBe('Living Room TV');
    expect(device?.manufacturer).toBe('Xiaomi');
    expect(device?.avTransportUrl).toBe(
      'http://192.168.1.100:8080/AVTransport/control',
    );
  });

  it('parses nested MediaRenderer in deviceList', () => {
    const nestedXml = `<?xml version="1.0"?>
<root>
  <URLBase>http://192.168.31.88:49152/</URLBase>
  <device>
    <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
    <deviceList>
      <device>
        <deviceType>urn:schemas-upnp-org:device:MediaRenderer:1</deviceType>
        <friendlyName>Mi TV</friendlyName>
        <serviceList>
          <service>
            <serviceType>urn:schemas-upnp-org:service:AVTransport:1</serviceType>
            <controlURL>/upnp/control/AVTransport1</controlURL>
          </service>
        </serviceList>
      </device>
    </deviceList>
  </device>
</root>`;
    const device = parseDeviceDescription(
      nestedXml,
      'http://192.168.31.88:49152/description.xml',
    );
    expect(device?.name).toBe('Mi TV');
    expect(device?.avTransportUrl).toBe(
      'http://192.168.31.88:49152/upnp/control/AVTransport1',
    );
  });
});

describe('probeDeviceAtIp', () => {
  it('finds device on alternate port 49152', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url === 'http://192.168.31.88:49152/description.xml') {
        return new Response(sampleRendererXml, { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    const device = await probeDeviceAtIp('192.168.31.88', fetchFn, { timeoutMs: 300 });
    expect(device?.name).toBe('Living Room TV');
    expect(fetchFn).toHaveBeenCalled();
  });

  it('retries with DLNA User-Agent after 403 from default client', async () => {
    let call = 0;
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      call++;
      const ua = (init?.headers as Record<string, string> | undefined)?.['User-Agent'] ?? '';
      if (call === 1) {
        return new Response('Forbidden', { status: 403 });
      }
      if (ua.includes('UPnP')) {
        return new Response(sampleRendererXml, { status: 200 });
      }
      return new Response('', { status: 403 });
    });
    const device = await probeDeviceAtIp('192.168.1.50', fetchFn, {
      timeoutMs: 300,
      tryAlternatePorts: false,
    });
    expect(device?.name).toBe('Living Room TV');
    expect(call).toBeGreaterThan(1);
  });

  it('parses UPnP XML even when status is 403', async () => {
    const fetchFn = vi.fn(async () => {
      return new Response(sampleRendererXml, { status: 403 });
    });
    const device = await probeDeviceAtIp('192.168.1.50', fetchFn, {
      timeoutMs: 300,
      tryAlternatePorts: false,
    });
    expect(device?.name).toBe('Living Room TV');
  });

  it('accepts full description URL pasted by user', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.startsWith('http://192.168.1.50:6200/')) {
        return new Response(sampleRendererXml, { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    const device = await probeDeviceAtIp(
      'http://192.168.1.50:6200/custom/desc.xml',
      fetchFn,
      { timeoutMs: 300 },
    );
    expect(device?.name).toBe('Living Room TV');
  });
});

describe('SOAP helpers', () => {
  it('builds SetAVTransportURI envelope', () => {
    const xml = buildSoapEnvelope(
      'urn:schemas-upnp-org:service:AVTransport:1',
      'SetAVTransportURI',
      { InstanceID: 0, CurrentURI: 'http://example.com/v.mp4', CurrentURIMetaData: '' },
    );
    expect(xml).toContain('SetAVTransportURI');
    expect(xml).toContain('http://example.com/v.mp4');
  });

  it('builds DIDL metadata', () => {
    const meta = buildDidlLiteMetadata({
      url: 'http://example.com/v.mp4',
      title: 'Test Video',
    });
    expect(meta).toContain('Test Video');
    expect(meta).toContain('video/mp4');
  });

  it('guesses mime types', () => {
    expect(guessMimeType('http://x.com/a.mp4')).toBe('video/mp4');
    expect(guessMimeType('http://x.com/a.m3u8')).toBe('application/vnd.apple.mpegurl');
  });

  it('resolves relative URLs', () => {
    expect(resolveUrl('http://192.168.1.1:8080/desc.xml', '/ctrl')).toBe(
      'http://192.168.1.1:8080/ctrl',
    );
  });
});

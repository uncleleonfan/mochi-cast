import { describe, expect, it } from 'vitest';
import {
  buildDidlLiteMetadata,
  buildMSearch,
  buildSoapEnvelope,
  guessMimeType,
  parseDeviceDescription,
  parseSsdpResponse,
  resolveUrl,
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

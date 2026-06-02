import {
  AV_TRANSPORT_SERVICE,
  type MediaItem,
  type PositionInfo,
  type TransportInfo,
} from './types.js';
import { buildDidlLiteMetadata, buildSoapEnvelope, extractSoapValue } from './soap.js';

export class AvTransportClient {
  constructor(
    private readonly controlUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async setAvTransportUri(item: MediaItem, withMetadata = true): Promise<void> {
    const metadata = withMetadata ? buildDidlLiteMetadata(item) : '';
    await this.invoke('SetAVTransportURI', {
      InstanceID: 0,
      CurrentURI: item.url,
      CurrentURIMetaData: metadata,
    });
  }

  async play(speed = '1'): Promise<void> {
    await this.invoke('Play', { InstanceID: 0, Speed: speed });
  }

  async pause(): Promise<void> {
    await this.invoke('Pause', { InstanceID: 0 });
  }

  async stop(): Promise<void> {
    await this.invoke('Stop', { InstanceID: 0 });
  }

  async seek(target: string): Promise<void> {
    await this.invoke('Seek', {
      InstanceID: 0,
      Unit: 'REL_TIME',
      Target: target,
    });
  }

  async getTransportInfo(): Promise<TransportInfo> {
    const body = await this.invoke('GetTransportInfo', { InstanceID: 0 });
    return {
      state: extractSoapValue(body, 'CurrentTransportState') ?? 'UNKNOWN',
      status: extractSoapValue(body, 'CurrentTransportStatus') ?? 'UNKNOWN',
      speed: extractSoapValue(body, 'CurrentSpeed') ?? '1',
    };
  }

  async getPositionInfo(): Promise<PositionInfo> {
    const body = await this.invoke('GetPositionInfo', { InstanceID: 0 });
    return {
      track: Number(extractSoapValue(body, 'Track') ?? 0),
      duration: extractSoapValue(body, 'TrackDuration') ?? '0:00:00',
      relTime: extractSoapValue(body, 'RelTime') ?? '0:00:00',
      absTime: extractSoapValue(body, 'AbsTime') ?? '0:00:00',
    };
  }

  private async invoke(
    action: string,
    args: Record<string, string | number>,
  ): Promise<string> {
    const envelope = buildSoapEnvelope(AV_TRANSPORT_SERVICE, action, args);
    const response = await this.fetchFn(this.controlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPAction: `"${AV_TRANSPORT_SERVICE}#${action}"`,
      },
      body: envelope,
      signal: AbortSignal.timeout(10000),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`SOAP ${action} failed (${response.status}): ${text.slice(0, 200)}`);
    }
    if (text.includes('Fault') || text.includes('errorCode')) {
      const fault = extractSoapValue(text, 'faultstring') ?? text.slice(0, 200);
      throw new Error(`SOAP fault in ${action}: ${fault}`);
    }
    return text;
  }
}

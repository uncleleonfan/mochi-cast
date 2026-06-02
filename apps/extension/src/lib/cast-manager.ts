import {
  DlnaController,
  matchDeviceProfile,
  type DlnaDevice,
  type MediaItem,
} from '@mochi-cast/dlna-core';
import type { DetectedVideo, PlaybackState } from '../shared/messages.js';
import { createLoggingFetch, isDebugEnabled, log, logError } from './debug-log.js';

let activeController: DlnaController | null = null;
let activeDeviceId: string | undefined;

export function getActiveDeviceId(): string | undefined {
  return activeDeviceId;
}

export function getActiveController(): DlnaController | null {
  return activeController;
}

export async function castToDevice(
  device: DlnaDevice,
  video: DetectedVideo,
): Promise<void> {
  log('cast', 'cast_start', {
    device: { name: device.name, ip: device.ip, avTransportUrl: device.avTransportUrl },
    video: { url: video.url, mimeType: video.mimeType, title: video.title },
  });
  const profile = matchDeviceProfile(device);
  log('cast', 'device_profile', { profileId: profile?.id ?? 'default' });
  const fetchFn = isDebugEnabled() ? createLoggingFetch('cast', extensionFetch) : extensionFetch;
  const controller = new DlnaController(device, profile, fetchFn);
  const item: MediaItem = {
    url: video.url,
    title: video.title,
    mimeType: video.mimeType,
  };

  try {
    await controller.cast(item);
    activeController = controller;
    activeDeviceId = device.id;
    log('cast', 'cast_ok', { deviceId: device.id });
  } catch (error) {
    logError('cast', 'cast_failed', error, { deviceIp: device.ip });
    throw error;
  }
}

export async function controlPlayback(
  action: 'play' | 'pause' | 'stop' | 'seek',
  seconds?: number,
): Promise<void> {
  if (!activeController) {
    throw new Error('No active casting session');
  }

  log('cast', 'control', { action, seconds });
  try {
    switch (action) {
      case 'play':
        await activeController.play();
        break;
      case 'pause':
        await activeController.pause();
        break;
      case 'stop':
        await activeController.stop();
        activeController = null;
        activeDeviceId = undefined;
        break;
      case 'seek':
        if (seconds === undefined) throw new Error('Seek requires seconds');
        await activeController.seek(seconds);
        break;
    }
    log('cast', 'control_ok', { action });
  } catch (error) {
    logError('cast', 'control_failed', error, { action });
    throw error;
  }
}

export async function getPlaybackState(): Promise<PlaybackState> {
  if (!activeController) {
    return { isCasting: false };
  }

  try {
    const [transport, position] = await Promise.all([
      activeController.getTransportInfo(),
      activeController.getPositionInfo(),
    ]);
    return {
      deviceId: activeDeviceId,
      isCasting: transport.state === 'PLAYING' || transport.state === 'PAUSED_PLAYBACK',
      transportState: transport.state,
      position: position.relTime,
      duration: position.duration,
    };
  } catch {
    return { deviceId: activeDeviceId, isCasting: true };
  }
}

async function extensionFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const merged: RequestInit & { targetAddressSpace?: string } = {
    ...init,
    targetAddressSpace: 'local',
  };
  return fetch(input, merged);
}

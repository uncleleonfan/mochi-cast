import {
  DlnaController,
  matchDeviceProfile,
  type DlnaDevice,
  type MediaItem,
} from '@mochi-cast/dlna-core';
import type { DetectedVideo, PlaybackState } from '../shared/messages.js';
import { isCastableUrl } from './video-scanner.js';
import {
  createLoggingFetch,
  formatUnknownError,
  isDebugEnabled,
  log,
  logError,
  toError,
} from './debug-log.js';

const LONG_CAST_URL = 800;

function buildCastMediaItem(video: DetectedVideo): MediaItem {
  const url = video.url?.trim() ?? '';
  if (!isCastableUrl(url)) {
    throw new Error('Cannot cast this URL — need an http(s) direct link (not blob/data)');
  }
  let mimeType = video.mimeType;
  if (!mimeType && /douyinvod|zjcdn|byte(?:ic)?cdn/i.test(url)) {
    mimeType = 'video/mp4';
  }
  return {
    url,
    title: video.title?.trim() || 'Video',
    mimeType: mimeType ?? undefined,
  };
}

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
  const item = buildCastMediaItem(video);
  const preferMetadata = profile?.requiresMetadata ?? true;
  const useMetadata = preferMetadata && item.url.length <= LONG_CAST_URL;

  try {
    await tryCast(controller, item, useMetadata, preferMetadata);
    activeController = controller;
    activeDeviceId = device.id;
    log('cast', 'cast_ok', { deviceId: device.id, urlLen: item.url.length });
  } catch (error) {
    logError('cast', 'cast_failed', error, {
      deviceIp: device.ip,
      urlLen: item.url.length,
      detail: formatUnknownError(error),
    });
    throw toError(error);
  }
}

async function tryCast(
  controller: DlnaController,
  item: MediaItem,
  withMetadata: boolean,
  canRetryWithoutMetadata: boolean,
): Promise<void> {
  try {
    await controller.setMedia(item, withMetadata);
    await controller.play();
  } catch (first) {
    if (withMetadata && canRetryWithoutMetadata) {
      log('cast', 'cast_retry_no_metadata', { urlLen: item.url.length });
      await controller.setMedia(item, false);
      await controller.play();
      return;
    }
    throw first;
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

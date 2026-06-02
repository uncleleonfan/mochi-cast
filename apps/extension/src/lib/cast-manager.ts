import {
  DlnaController,
  matchDeviceProfile,
  type DlnaDevice,
  type MediaItem,
} from '@mochi-cast/dlna-core';
import type { DetectedVideo, PlaybackState } from '../shared/messages.js';

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
  const profile = matchDeviceProfile(device);
  const controller = new DlnaController(device, profile, extensionFetch);
  const item: MediaItem = {
    url: video.url,
    title: video.title,
    mimeType: video.mimeType,
  };

  await controller.cast(item);
  activeController = controller;
  activeDeviceId = device.id;
}

export async function controlPlayback(
  action: 'play' | 'pause' | 'stop' | 'seek',
  seconds?: number,
): Promise<void> {
  if (!activeController) {
    throw new Error('No active casting session');
  }

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
  return fetch(input, init);
}

import type { DeviceProfile } from './types.js';

/** Vendor-specific compatibility profiles for common TV brands */
export const DEVICE_PROFILES: DeviceProfile[] = [
  {
    id: 'xiaomi',
    name: 'Xiaomi TV / Box',
    setUriDelayMs: 500,
    requiresMetadata: true,
  },
  {
    id: 'tcl',
    name: 'TCL TV',
    setUriDelayMs: 300,
    requiresMetadata: true,
  },
  {
    id: 'hisense',
    name: 'Hisense TV',
    requiresMetadata: true,
  },
  {
    id: 'sony',
    name: 'Sony Bravia',
    requiresMetadata: false,
  },
  {
    id: 'lg',
    name: 'LG TV',
    requiresMetadata: false,
  },
  {
    id: 'samsung',
    name: 'Samsung TV',
    requiresMetadata: true,
  },
  {
    id: 'generic',
    name: 'Generic DLNA',
    requiresMetadata: true,
  },
];

export function matchDeviceProfile(device: {
  manufacturer?: string;
  model?: string;
  name?: string;
}): DeviceProfile {
  const haystack = [device.manufacturer, device.model, device.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('xiaomi') || haystack.includes('mi box') || haystack.includes('redmi')) {
    return DEVICE_PROFILES.find((p) => p.id === 'xiaomi')!;
  }
  if (haystack.includes('tcl')) {
    return DEVICE_PROFILES.find((p) => p.id === 'tcl')!;
  }
  if (haystack.includes('hisense')) {
    return DEVICE_PROFILES.find((p) => p.id === 'hisense')!;
  }
  if (haystack.includes('sony') || haystack.includes('bravia')) {
    return DEVICE_PROFILES.find((p) => p.id === 'sony')!;
  }
  if (haystack.includes('lg')) {
    return DEVICE_PROFILES.find((p) => p.id === 'lg')!;
  }
  if (haystack.includes('samsung')) {
    return DEVICE_PROFILES.find((p) => p.id === 'samsung')!;
  }
  return DEVICE_PROFILES.find((p) => p.id === 'generic')!;
}

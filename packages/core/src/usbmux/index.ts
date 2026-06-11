/**
 * usbmux protocol implementation
 */

export * from './types';
export * from './MuxDevice';
export * from './UsbMuxConnection';
export * from './PlistMuxConnection';

/**
 * Convenience function: List all connected devices
 */
import { UsbMuxConnection } from './UsbMuxConnection';
import { UsbMuxDevice } from './types';

export async function listDevices(usbmuxAddress?: string): Promise<UsbMuxDevice[]> {
  const mux = await UsbMuxConnection.create(usbmuxAddress);
  try {
    const devices = await mux.listDevices();
    return devices;
  } finally {
    await mux.close();
  }
}

/**
 * Convenience function: Select a specific device
 */
export async function selectDevice(
  udid?: string,
  connectionType?: string,
  usbmuxAddress?: string
): Promise<UsbMuxDevice | null> {
  const devices = await listDevices(usbmuxAddress);

  let selected: UsbMuxDevice | null = null;

  for (const device of devices) {
    // Filter by connection type
    if (connectionType && device.connectionType !== connectionType) {
      continue;
    }

    // Filter by UDID
    if (udid) {
      const normalizedSerial = device.serial.replace(/-/g, '');
      const normalizedUdid = udid.replace(/-/g, '');
      if (normalizedSerial !== normalizedUdid) {
        continue;
      }
    }

    selected = device;

    // Prefer USB connection
    if (device.connectionType === 'USB') {
      return device;
    }
  }

  return selected;
}

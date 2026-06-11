/**
 * usbmux protocol implementation
 */
export * from './types';
export * from './MuxDevice';
export * from './UsbMuxConnection';
export * from './PlistMuxConnection';
import { UsbMuxDevice } from './types';
export declare function listDevices(usbmuxAddress?: string): Promise<UsbMuxDevice[]>;
/**
 * Convenience function: Select a specific device
 */
export declare function selectDevice(udid?: string, connectionType?: string, usbmuxAddress?: string): Promise<UsbMuxDevice | null>;
//# sourceMappingURL=index.d.ts.map
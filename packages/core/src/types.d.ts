/**
 * Common type definitions for ts-mobiledevice
 */
export type ConnectionType = 'USB' | 'Network';
export interface DeviceIdentifier {
    udid?: string;
    serial?: string;
}
export interface PlatformPaths {
    pairRecordsDir: string;
    usbmuxdSocket: string | {
        host: string;
        port: number;
    };
}
export type PlistValue = string | number | boolean | Buffer | Date | PlistObject | PlistArray;
export interface PlistObject {
    [key: string]: PlistValue;
}
export type PlistArray = PlistValue[];
export interface ServiceOptions {
    enableSSL?: boolean;
    timeout?: number;
}
export type ProgressCallback = (current: number, total: number) => void;
//# sourceMappingURL=types.d.ts.map
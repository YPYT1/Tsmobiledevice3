/**
 * Common type definitions for ts-mobiledevice
 */

// Device connection types
export type ConnectionType = 'USB' | 'Network';

// Device identifier
export interface DeviceIdentifier {
  udid?: string;
  serial?: string;
}

// Platform-specific paths
export interface PlatformPaths {
  pairRecordsDir: string;
  usbmuxdSocket: string | { host: string; port: number };
}

// Plist types
export type PlistValue = string | number | boolean | Buffer | Date | PlistObject | PlistArray;
export interface PlistObject {
  [key: string]: PlistValue;
}
export type PlistArray = PlistValue[];

// Service connection options
export interface ServiceOptions {
  enableSSL?: boolean;
  timeout?: number;
}

// Progress callback for long-running operations
export type ProgressCallback = (current: number, total: number) => void;

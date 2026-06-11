/**
 * Type definitions for usbmux protocol
 */

// usbmuxd protocol version
export enum UsbMuxVersion {
  BINARY = 0,
  PLIST = 1,
}

// usbmuxd result codes
export enum UsbMuxResult {
  OK = 0,
  BAD_COMMAND = 1,
  BAD_DEVICE = 2,
  CONNECTION_REFUSED = 3,
  NO_SUCH_SERVICE = 4,
  BAD_VERSION = 6,
}

// usbmuxd message types
export enum UsbMuxMessageType {
  RESULT = 1,
  CONNECT = 2,
  LISTEN = 3,
  ADD = 4,
  REMOVE = 5,
  PAIRED = 6,
  PLIST = 8,
}

// usbmuxd header structure
export interface UsbMuxHeader {
  version: UsbMuxVersion;
  message: UsbMuxMessageType;
  tag: number;
}

// Device record
export interface UsbMuxDevice {
  devid: number;
  serial: string;
  connectionType: ConnectionType;
}

// Connection type
export type ConnectionType = 'USB' | 'Network';

// usbmuxd connect request data
export interface ConnectRequestData {
  device_id: number;
  port: number;
}

// usbmuxd result response data
export interface ResultResponseData {
  result: UsbMuxResult;
}

// usbmuxd add device data
export interface AddDeviceData {
  device_id: number;
  product_id: number;
  serial_number: string;
  location: number;
}

// Plist protocol message
export interface PlistMessage {
  MessageType: string;
  [key: string]: any;
}

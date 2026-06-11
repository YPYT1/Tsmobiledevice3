/**
 * Type definitions for usbmux protocol
 */
export declare enum UsbMuxVersion {
    BINARY = 0,
    PLIST = 1
}
export declare enum UsbMuxResult {
    OK = 0,
    BAD_COMMAND = 1,
    BAD_DEVICE = 2,
    CONNECTION_REFUSED = 3,
    NO_SUCH_SERVICE = 4,
    BAD_VERSION = 6
}
export declare enum UsbMuxMessageType {
    RESULT = 1,
    CONNECT = 2,
    LISTEN = 3,
    ADD = 4,
    REMOVE = 5,
    PAIRED = 6,
    PLIST = 8
}
export interface UsbMuxHeader {
    version: UsbMuxVersion;
    message: UsbMuxMessageType;
    tag: number;
}
export interface UsbMuxDevice {
    devid: number;
    serial: string;
    connectionType: 'USB' | 'Network';
}
export interface ConnectRequestData {
    device_id: number;
    port: number;
}
export interface ResultResponseData {
    result: UsbMuxResult;
}
export interface AddDeviceData {
    device_id: number;
    product_id: number;
    serial_number: string;
    location: number;
}
export interface PlistMessage {
    MessageType: string;
    [key: string]: any;
}
//# sourceMappingURL=types.d.ts.map
/**
 * Plist protocol MuxConnection - modern usbmuxd protocol
 */
import net from 'net';
import { UsbMuxConnection } from './UsbMuxConnection';
import { UsbMuxDevice } from './types';
export declare class PlistMuxConnection extends UsbMuxConnection {
    private version;
    constructor(socket: net.Socket);
    /**
     * Send plist message
     */
    private send;
    /**
     * Receive plist response
     */
    private receive;
    /**
     * Send and receive with validation
     */
    private sendReceive;
    /**
     * List all connected devices
     */
    listDevices(): Promise<UsbMuxDevice[]>;
    /**
     * Get System BUID
     */
    getBuid(): Promise<string>;
    /**
     * Get pair record for a device
     */
    getPairRecord(serial: string): Promise<any>;
    /**
     * Save pair record
     */
    savePairRecord(serial: string, deviceId: number, recordData: Buffer): Promise<void>;
    /**
     * Connect to a device port
     */
    connectDevice(deviceId: number, port: number): Promise<net.Socket>;
    /**
     * Start listening for device events
     */
    listen(): Promise<void>;
    /**
     * Receive device state update (for listening mode)
     */
    receiveDeviceStateUpdate(): Promise<void>;
}
//# sourceMappingURL=PlistMuxConnection.d.ts.map
/**
 * UsbMux device entity
 */
export declare class MuxDevice {
    readonly devid: number;
    readonly serial: string;
    readonly connectionType: 'USB' | 'Network';
    constructor(devid: number, serial: string, connectionType: 'USB' | 'Network');
    /**
     * Check if device is connected via USB
     */
    get isUsb(): boolean;
    /**
     * Check if device is connected via Network (Wi-Fi)
     */
    get isNetwork(): boolean;
    /**
     * Check if this device matches the given UDID
     */
    matchesUdid(udid: string): boolean;
}
//# sourceMappingURL=MuxDevice.d.ts.map
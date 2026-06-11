"use strict";
/**
 * UsbMux device entity
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MuxDevice = void 0;
class MuxDevice {
    devid;
    serial;
    connectionType;
    constructor(devid, serial, connectionType) {
        this.devid = devid;
        this.serial = serial;
        this.connectionType = connectionType;
    }
    /**
     * Check if device is connected via USB
     */
    get isUsb() {
        return this.connectionType === 'USB';
    }
    /**
     * Check if device is connected via Network (Wi-Fi)
     */
    get isNetwork() {
        return this.connectionType === 'Network';
    }
    /**
     * Check if this device matches the given UDID
     */
    matchesUdid(udid) {
        const normalizedSerial = this.serial.replace(/-/g, '');
        const normalizedUdid = udid.replace(/-/g, '');
        return normalizedSerial === normalizedUdid;
    }
}
exports.MuxDevice = MuxDevice;
//# sourceMappingURL=MuxDevice.js.map
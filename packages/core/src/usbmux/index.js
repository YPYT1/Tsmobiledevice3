"use strict";
/**
 * usbmux protocol implementation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDevices = listDevices;
exports.selectDevice = selectDevice;
__exportStar(require("./types"), exports);
__exportStar(require("./MuxDevice"), exports);
__exportStar(require("./UsbMuxConnection"), exports);
__exportStar(require("./PlistMuxConnection"), exports);
/**
 * Convenience function: List all connected devices
 */
const PlistMuxConnection_1 = require("./PlistMuxConnection");
async function listDevices(usbmuxAddress) {
    const mux = new PlistMuxConnection_1.PlistMuxConnection(await (await Promise.resolve().then(() => __importStar(require('./UsbMuxConnection')))).UsbMuxConnection.createUsbmuxSocket(usbmuxAddress));
    try {
        const devices = await mux.listDevices();
        return devices;
    }
    finally {
        await mux.close();
    }
}
/**
 * Convenience function: Select a specific device
 */
async function selectDevice(udid, connectionType, usbmuxAddress) {
    const devices = await listDevices(usbmuxAddress);
    let selected = null;
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
//# sourceMappingURL=index.js.map
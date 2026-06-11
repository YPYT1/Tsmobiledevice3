"use strict";
/**
 * Plist protocol MuxConnection - modern usbmuxd protocol
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlistMuxConnection = void 0;
const plist_1 = __importDefault(require("plist"));
const exceptions_1 = require("../exceptions");
const UsbMuxConnection_1 = require("./UsbMuxConnection");
const MuxDevice_1 = require("./MuxDevice");
const types_1 = require("./types");
class PlistMuxConnection extends UsbMuxConnection_1.UsbMuxConnection {
    version = types_1.UsbMuxVersion.PLIST;
    constructor(socket) {
        super();
        this.socket = socket;
    }
    /**
     * Send plist message
     */
    async send(data) {
        this.assertNotConnected();
        if (!this.socket) {
            throw new exceptions_1.MuxException('Socket not connected');
        }
        // Build plist request
        const request = {
            ClientVersionString: 'qt4i-usbmuxd',
            ProgName: 'ts-mobiledevice',
            kLibUSBMuxVersion: 3,
        };
        Object.assign(request, data);
        // Convert to plist XML
        const plistData = plist_1.default.build(request);
        // Build usbmux packet
        const header = Buffer.alloc(12);
        header.writeUInt32LE(this.version, 0); // version
        header.writeUInt32LE(types_1.UsbMuxMessageType.PLIST, 4); // message type
        header.writeUInt32LE(this.tag, 8); // tag
        const payload = Buffer.from(plistData, 'utf8');
        const packet = Buffer.concat([header, payload]);
        // Add length prefix
        const lengthPrefix = Buffer.alloc(4);
        lengthPrefix.writeUInt32LE(packet.length, 0);
        const fullPacket = Buffer.concat([lengthPrefix, packet]);
        // Send packet
        await new Promise((resolve, reject) => {
            this.socket.write(fullPacket, (error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        });
        this.tag++;
    }
    /**
     * Receive plist response
     */
    async receive(expectedTag) {
        this.assertNotConnected();
        // Receive complete packet
        const packet = await this.recvPacket();
        // Parse header (first 12 bytes)
        const version = packet.readUInt32LE(4);
        const messageType = packet.readUInt32LE(8);
        const tag = packet.readUInt32LE(12);
        if (messageType !== types_1.UsbMuxMessageType.PLIST) {
            throw new exceptions_1.MuxException(`Received non-plist type: ${messageType}`);
        }
        if (expectedTag !== undefined && tag !== expectedTag) {
            throw new exceptions_1.MuxException(`Reply tag mismatch: expected ${expectedTag}, got ${tag}`);
        }
        // Parse plist payload
        const payload = packet.subarray(16);
        const plistString = payload.toString('utf8');
        const response = plist_1.default.parse(plistString);
        return response;
    }
    /**
     * Send and receive with validation
     */
    async sendReceive(data) {
        await this.send(data);
        const response = await this.receive(this.tag - 1);
        if (response.MessageType !== 'Result') {
            throw new exceptions_1.MuxException(`Got invalid message: ${response.MessageType}`);
        }
        if (response.Number !== 0) {
            this.raiseMuxException(response.Number, `Error: ${response.MessageType}`);
        }
    }
    /**
     * List all connected devices
     */
    async listDevices() {
        this.devices = [];
        await this.send({ MessageType: 'ListDevices' });
        const response = await this.receive(this.tag - 1);
        const deviceList = response.DeviceList;
        if (!deviceList) {
            throw new exceptions_1.MuxException(`Got invalid response: ${response}`);
        }
        // Parse device list
        for (const item of deviceList) {
            if (item.MessageType === 'Attached') {
                const device = {
                    devid: item.DeviceID,
                    serial: item.Properties.SerialNumber,
                    connectionType: item.Properties.ConnectionType,
                };
                this.devices.push(device);
            }
        }
        return this.devices;
    }
    /**
     * Get System BUID
     */
    async getBuid() {
        await this.send({ MessageType: 'ReadBUID' });
        const response = await this.receive(this.tag - 1);
        return response.BUID;
    }
    /**
     * Get pair record for a device
     */
    async getPairRecord(serial) {
        await this.send({
            MessageType: 'ReadPairRecord',
            PairRecordID: serial,
        });
        const response = await this.receive(this.tag - 1);
        const pairRecordData = response.PairRecordData;
        if (!pairRecordData) {
            throw new exceptions_1.NotPairedError('Device should be paired first');
        }
        // Parse pair record plist
        const pairRecord = plist_1.default.parse(pairRecordData.toString('utf8'));
        return pairRecord;
    }
    /**
     * Save pair record
     */
    async savePairRecord(serial, deviceId, recordData) {
        await this.sendReceive({
            MessageType: 'SavePairRecord',
            PairRecordID: serial,
            PairRecordData: recordData,
            DeviceID: deviceId,
        });
    }
    /**
     * Connect to a device port
     */
    async connectDevice(deviceId, port) {
        // Send connect request
        await this.sendReceive({
            MessageType: 'Connect',
            DeviceID: deviceId,
            PortNumber: port,
        });
        // Mark as connected and return socket
        this.connected = true;
        if (!this.socket) {
            throw new exceptions_1.MuxException('Socket not connected');
        }
        return this.socket;
    }
    /**
     * Start listening for device events
     */
    async listen() {
        await this.sendReceive({ MessageType: 'Listen' });
    }
    /**
     * Receive device state update (for listening mode)
     */
    async receiveDeviceStateUpdate() {
        const response = await this.receive();
        if (response.MessageType === 'Attached') {
            const device = new MuxDevice_1.MuxDevice(response.DeviceID, response.Properties.SerialNumber, response.Properties.ConnectionType);
            this.devices.push(device);
        }
        else if (response.MessageType === 'Detached') {
            this.devices = this.devices.filter((d) => d.devid !== response.DeviceID);
        }
        else if (response.MessageType === 'Paired') {
            // Pairing notifications - ignore
            return;
        }
        else {
            throw new exceptions_1.MuxException(`Invalid packet type received: ${response.MessageType}`);
        }
    }
}
exports.PlistMuxConnection = PlistMuxConnection;
//# sourceMappingURL=PlistMuxConnection.js.map
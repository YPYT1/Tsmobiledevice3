/**
 * Plist protocol MuxConnection - modern usbmuxd protocol
 */

import net from 'net';
import plist from 'plist';
import { MuxException, NotPairedError } from '../exceptions';
import { UsbMuxConnection } from './UsbMuxConnection';
import { MuxDevice } from './MuxDevice';
import {
  UsbMuxMessageType,
  UsbMuxResult,
  UsbMuxVersion,
  UsbMuxDevice,
} from './types';

export class PlistMuxConnection extends UsbMuxConnection {
  private version = UsbMuxVersion.PLIST;

  constructor(socket: net.Socket) {
    super();
    this.socket = socket;
  }

  /**
   * Send plist message
   */
  private async send(data: any): Promise<void> {
    this.assertNotConnected();
    if (!this.socket) throw new MuxException('Socket not connected');

    const request = {
      ClientVersionString: 'qt4i-usbmuxd',
      ProgName: 'ts-mobiledevice',
      kLibUSBMuxVersion: 3,
      ...data,
    };
    const payload = Buffer.from(plist.build(request), 'utf8');
    // Single allocation: 4 (len) + 4 (version) + 4 (msgtype) + 4 (tag) + payload
    const packet = Buffer.alloc(16 + payload.length);
    packet.writeUInt32LE(packet.length, 0);
    packet.writeUInt32LE(this.version, 4);
    packet.writeUInt32LE(UsbMuxMessageType.PLIST, 8);
    packet.writeUInt32LE(this.tag, 12);
    payload.copy(packet, 16);

    await new Promise<void>((resolve, reject) => {
      this.socket!.write(packet, (err) => err ? reject(err) : resolve());
    });
    this.tag++;
  }

  /**
   * Receive plist response
   */
  private async receive(expectedTag?: number): Promise<any> {
    this.assertNotConnected();

    const packet = await this.recvPacket();

    // packet: length(4) + version(4) + msgtype(4) + tag(4) + plist
    const version = packet.readUInt32LE(4);
    const messageType = packet.readUInt32LE(8);
    const tag = packet.readUInt32LE(12);

    if (messageType !== UsbMuxMessageType.PLIST) {
      throw new MuxException(`Received non-plist type: ${messageType}`);
    }

    if (expectedTag !== undefined && tag !== expectedTag) {
      throw new MuxException(`Reply tag mismatch: expected ${expectedTag}, got ${tag}`);
    }

    // Parse plist payload
    const payload = packet.subarray(16);
    const plistString = payload.toString('utf8');
    const response = plist.parse(plistString);

    return response;
  }

  /**
   * Send and receive with validation
   */
  private async sendReceive(data: any): Promise<void> {
    await this.send(data);
    const response = await this.receive(this.tag - 1);

    if (response.MessageType !== 'Result') {
      throw new MuxException(`Got invalid message: ${response.MessageType}`);
    }

    if (response.Number !== 0) {
      this.raiseMuxException(response.Number, `Error: ${response.MessageType}`);
    }
  }

  /**
   * List all connected devices
   */
  public async listDevices(): Promise<UsbMuxDevice[]> {
    this.devices = [];

    await this.send({ MessageType: 'ListDevices' });
    const response = await this.receive(this.tag - 1);

    const deviceList = response.DeviceList;
    if (!deviceList) {
      throw new MuxException(`Got invalid response: ${response}`);
    }

    // Parse device list
    for (const item of deviceList) {
      if (item.MessageType === 'Attached') {
        const device: UsbMuxDevice = {
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
  public async getBuid(): Promise<string> {
    await this.send({ MessageType: 'ReadBUID' });
    const response = await this.receive(this.tag - 1);
    return response.BUID;
  }

  /**
   * Get pair record for a device
   */
  public async getPairRecord(serial: string): Promise<any> {
    await this.send({
      MessageType: 'ReadPairRecord',
      PairRecordID: serial,
    });

    const response = await this.receive(this.tag - 1);
    const pairRecordData = response.PairRecordData;

    if (!pairRecordData) {
      throw new NotPairedError('Device should be paired first');
    }

    // Parse pair record plist
    const pairRecord = plist.parse(pairRecordData.toString('utf8'));
    return pairRecord;
  }

  /**
   * Save pair record
   */
  public async savePairRecord(serial: string, deviceId: number, recordData: Buffer): Promise<void> {
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
  public async connectDevice(deviceId: number, port: number): Promise<net.Socket> {
    // Send connect request
    await this.sendReceive({
      MessageType: 'Connect',
      DeviceID: deviceId,
      PortNumber: port,
    });

    // Mark as connected and return socket
    this.connected = true;

    if (!this.socket) {
      throw new MuxException('Socket not connected');
    }

    return this.socket;
  }

  /**
   * Start listening for device events
   */
  public async listen(): Promise<void> {
    await this.sendReceive({ MessageType: 'Listen' });
  }

  /**
   * Receive device state update (for listening mode)
   */
  public async receiveDeviceStateUpdate(): Promise<void> {
    const response = await this.receive();

    if (response.MessageType === 'Attached') {
      const device = new MuxDevice(
        response.DeviceID,
        response.Properties.SerialNumber,
        response.Properties.ConnectionType
      );
      this.devices.push(device as any);
    } else if (response.MessageType === 'Detached') {
      this.devices = this.devices.filter((d: any) => d.devid !== response.DeviceID);
    } else if (response.MessageType === 'Paired') {
      // Pairing notifications - ignore
      return;
    } else {
      throw new MuxException(`Invalid packet type received: ${response.MessageType}`);
    }
  }
}
import * as net from 'net';
// @ts-ignore
import bplistParser from 'bplist-parser';
// @ts-ignore
import bplistCreator from 'bplist-creator';
import { readExactly } from '../utils/socket';

export class ScreenshotService {
  private didHandshake = false;

  constructor(private socket: net.Socket) {}

  private write(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  private readExactly(size: number): Promise<Buffer> {
    return readExactly(this.socket, size, 15000);
  }

  private async recvPlist(): Promise<any[]> {
    const lenBuf = await this.readExactly(4);
    const size = lenBuf.readUInt32BE(0);
    const payload = await this.readExactly(size);
    const parsed = await bplistParser.parseBuffer(payload);
    return parsed[0];
  }

  private async sendPlist(obj: any): Promise<void> {
    const payload: Buffer = bplistCreator(obj);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(payload.length, 0);
    await this.write(Buffer.concat([lenBuf, payload]));
  }

  private async handshake(): Promise<void> {
    if (this.didHandshake) return;
    const versionMsg = await this.recvPlist();
    const versionMajor = versionMsg[1];
    await this.sendPlist(['DLMessageVersionExchange', 'DLVersionsOk', versionMajor]);
    const readyMsg = await this.recvPlist();
    if (readyMsg[0] !== 'DLMessageDeviceReady') {
      throw new Error(`Screenshotr not ready: ${readyMsg[0]}`);
    }
    this.didHandshake = true;
  }

  async takeScreenshot(): Promise<Buffer> {
    await this.handshake();
    await this.sendPlist(['DLMessageProcessMessage', { MessageType: 'ScreenShotRequest' }]);
    const response = await this.recvPlist();
    if (response[0] === 'DLMessageProcessMessage' && response[1]?.MessageType === 'ScreenShotReply') {
      return response[1].ScreenShotData as Buffer;
    }
    throw new Error(`Invalid screenshot response: ${JSON.stringify(response)}`);
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

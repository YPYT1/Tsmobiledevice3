import * as net from 'net';
import plist from 'plist';
import { readExactly } from '../utils/socket';

export class DeviceLinkService {
  static readonly DL_MESSAGE_VERSION_EXCHANGE = 'DLMessageVersionExchange';
  static readonly DL_MESSAGE_DEVICE_READY = 'DLMessageDeviceReady';
  static readonly DL_MESSAGE_PROCESS_MESSAGE = 'DLMessageProcessMessage';
  static readonly DL_MESSAGE_DISCONNECT = 'DLMessageDisconnect';

  constructor(protected socket: net.Socket) {}

  protected async _send(msg: any[]): Promise<void> {
    const payload = Buffer.from(plist.build(msg as any), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
  }

  protected async _recv(): Promise<any[]> {
    const lenBuf = await readExactly(this.socket, 4, 15000);
    const data = await readExactly(this.socket, lenBuf.readUInt32BE(0), 15000);
    return plist.parse(data.toString('utf8')) as any[];
  }

  async versionExchange(localMajor: number, localMinor: number): Promise<[number, number]> {
    const msg = await this._recv();
    if (!Array.isArray(msg) || msg[0] !== DeviceLinkService.DL_MESSAGE_VERSION_EXCHANGE) {
      throw new Error(`Expected VersionExchange, got: ${JSON.stringify(msg)}`);
    }
    const devMajor = msg[1] as number;
    const devMinor = msg[2] as number;
    if (devMajor > localMajor) throw new Error(`Device version ${devMajor}.${devMinor} > local ${localMajor}.${localMinor}`);
    await this._send([DeviceLinkService.DL_MESSAGE_VERSION_EXCHANGE, 'DLVersionsOk', localMajor]);
    const ready = await this._recv();
    if (!Array.isArray(ready) || ready[0] !== DeviceLinkService.DL_MESSAGE_DEVICE_READY) {
      throw new Error(`Expected DeviceReady, got: ${JSON.stringify(ready)}`);
    }
    return [devMajor, devMinor];
  }

  async sendProcessMessage(msg: Record<string, any>): Promise<void> {
    await this._send([DeviceLinkService.DL_MESSAGE_PROCESS_MESSAGE, msg]);
  }

  async recvProcessMessage(): Promise<Record<string, any>> {
    while (true) {
      const msg = await this._recv();
      if (Array.isArray(msg) && msg[0] === DeviceLinkService.DL_MESSAGE_PROCESS_MESSAGE) return msg[1];
      if (Array.isArray(msg) && msg[0] === DeviceLinkService.DL_MESSAGE_DISCONNECT) throw new Error('Device disconnected');
    }
  }

  async disconnect(): Promise<void> {
    try { await this._send([DeviceLinkService.DL_MESSAGE_DISCONNECT]); } catch { /* ignore */ }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

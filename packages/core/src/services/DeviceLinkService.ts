import net from 'net';
import plist from 'plist';

// DeviceLink is the base for DTX/Instruments services
// It implements the plist-based framing used before DTX takes over
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
    const lenBuf = await this._readExactly(4);
    const data = await this._readExactly(lenBuf.readUInt32BE(0));
    return plist.parse(data.toString('utf8')) as any[];
  }

  protected _readExactly(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error('timeout')), 15000);
      const tryRead = () => {
        while (received < size) { const c = sock.read(size - received) as Buffer | null; if (!c) break; chunks.push(c); received += c.length; }
        if (received >= size) { clearTimeout(timer); sock.removeListener('readable', tryRead); sock.removeListener('error', onErr); sock.removeListener('close', onClose); resolve(Buffer.concat(chunks).subarray(0, size)); }
      };
      const onErr = (e: Error) => cleanup(e);
      const onClose = () => cleanup(new Error('closed'));
      const cleanup = (e: Error) => { clearTimeout(timer); sock.removeListener('readable', tryRead); sock.removeListener('error', onErr); sock.removeListener('close', onClose); reject(e); };
      sock.on('readable', tryRead); sock.once('error', onErr); sock.once('close', onClose); tryRead();
    });
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

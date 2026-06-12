import net from 'net';
import plist from 'plist';
// @ts-ignore
import bplistParser from 'bplist-parser';

export enum InterfaceOrientation {
  PORTRAIT = 1,
  PORTRAIT_UPSIDE_DOWN = 2,
  LANDSCAPE = 3,
  LANDSCAPE_HOME_TO_LEFT = 4,
}

export class SpringBoardService {
  static readonly SERVICE_NAME = 'com.apple.springboardservices';
  static readonly RSD_SERVICE_NAME = 'com.apple.springboardservices.shim.remote';

  constructor(private socket: net.Socket) {}

  private async sendRecv(msg: Record<string, any>): Promise<Record<string, any>> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    return this._recv();
  }

  private async _recv(): Promise<Record<string, any>> {
    const lenBuf = await this._readExactly(4);
    const data = await this._readExactly(lenBuf.readUInt32BE(0));
    if (data[0] === 0x62 && data[1] === 0x70) { // 'bp' = bplist
      return (await bplistParser.parseBuffer(data))[0];
    }
    return plist.parse(data.toString('utf8')) as Record<string, any>;
  }

  private _readExactly(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error('timeout')), 10000);
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

  async getIconState(formatVersion = '2'): Promise<any[]> {
    return (await this.sendRecv({ command: 'getIconState', formatVersion })) as any;
  }

  async getIconPngData(bundleId: string): Promise<Buffer> {
    const r = await this.sendRecv({ command: 'getIconPNGData', bundleId });
    return r.pngData as Buffer;
  }

  async getInterfaceOrientation(): Promise<InterfaceOrientation> {
    const r = await this.sendRecv({ command: 'getInterfaceOrientation' });
    return r.interfaceOrientation as InterfaceOrientation;
  }

  async getWallpaperPngData(): Promise<Buffer> {
    const r = await this.sendRecv({ command: 'getHomeScreenWallpaperPNGData' });
    return r.pngData as Buffer;
  }

  async getHomeScreenIconMetrics(): Promise<Record<string, number>> {
    return this.sendRecv({ command: 'getHomeScreenIconMetrics' });
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

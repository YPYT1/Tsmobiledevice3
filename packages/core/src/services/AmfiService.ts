import net from 'net';
import plist from 'plist';

export class AmfiService {
  static readonly SERVICE_NAME = 'com.apple.amfi.lockdown';
  static readonly DEVELOPER_MODE_REVEAL = 0;
  static readonly DEVELOPER_MODE_ENABLE = 1;
  static readonly DEVELOPER_MODE_ACCEPT = 2;

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

  async revealDeveloperModeOption(): Promise<void> {
    const r = await this.sendRecv({ action: AmfiService.DEVELOPER_MODE_REVEAL });
    if (!r.success) throw new Error(`revealDeveloperModeOption failed: ${JSON.stringify(r)}`);
  }

  async enableDeveloperMode(): Promise<void> {
    const r = await this.sendRecv({ action: AmfiService.DEVELOPER_MODE_ENABLE });
    if (r.Error) throw new Error(r.Error);
    if (!r.success) throw new Error(`enableDeveloperMode failed: ${JSON.stringify(r)}`);
  }

  async enableDeveloperModePostRestart(): Promise<void> {
    const r = await this.sendRecv({ action: AmfiService.DEVELOPER_MODE_ACCEPT });
    if (!r.success) throw new Error(`enableDeveloperModePostRestart failed: ${JSON.stringify(r)}`);
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

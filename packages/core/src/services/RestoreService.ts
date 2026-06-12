import net from 'net';
import plist from 'plist';

export class RestoreService {
  static readonly SERVICE_NAME = 'com.apple.RestoreRemoteServices.restoreserviced';

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

  private async validate(command: string): Promise<Record<string, any>> {
    const r = await this.sendRecv({ command });
    if (r.result !== 'success') throw new Error(`${command} failed: ${JSON.stringify(r)}`);
    return r;
  }

  async enterRecovery(): Promise<void> { await this.validate('recovery'); }
  async reboot(): Promise<void> { await this.validate('reboot'); }
  async delayRecoveryImage(): Promise<void> { await this.validate('delayrecoveryimage'); }
  async getPreflightInfo(): Promise<Record<string, any>> { return this.sendRecv({ command: 'getpreflightinfo' }); }
  async getNonces(): Promise<Record<string, any>> { return this.sendRecv({ command: 'getnonces' }); }
  async getAppParameters(): Promise<Record<string, any>> { return this.validate('getappparameters'); }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

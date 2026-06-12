import net from 'net';
import plist from 'plist';

export class HeartbeatService {
  static readonly SERVICE_NAME = 'com.apple.mobile.heartbeat';
  static readonly RSD_SERVICE_NAME = 'com.apple.mobile.heartbeat.shim.remote';

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
    const payload = await this._readExactly(lenBuf.readUInt32BE(0));
    return plist.parse(payload.toString('utf8')) as Record<string, any>;
  }

  private _readExactly(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error('timeout')), 10000);
      const tryRead = () => {
        while (received < size) {
          const chunk = sock.read(size - received) as Buffer | null;
          if (!chunk) break;
          chunks.push(chunk);
          received += chunk.length;
        }
        if (received >= size) { clearTimeout(timer); sock.removeListener('readable', tryRead); sock.removeListener('error', onError); sock.removeListener('close', onClose); resolve(Buffer.concat(chunks).subarray(0, size)); }
      };
      const onError = (e: Error) => cleanup(e);
      const onClose = () => cleanup(new Error('Socket closed'));
      const cleanup = (e: Error) => { clearTimeout(timer); sock.removeListener('readable', tryRead); sock.removeListener('error', onError); sock.removeListener('close', onClose); reject(e); };
      sock.on('readable', tryRead);
      sock.once('error', onError);
      sock.once('close', onClose);
      tryRead();
    });
  }

  async start(intervalMs?: number): Promise<void> {
    const deadline = intervalMs != null ? Date.now() + intervalMs : Infinity;
    while (Date.now() < deadline) {
      const msg = await this._recv();
      if (msg.Command === 'Marco') {
        await this.sendRecv({ Command: 'Polo' });
      }
    }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

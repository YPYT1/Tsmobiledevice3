import net from 'net';
import plist from 'plist';

export class FileRelayService {
  static readonly SERVICE_NAME = 'com.apple.mobile.file_relay';

  constructor(private socket: net.Socket) {}

  private async _send(msg: Record<string, any>): Promise<void> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
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
      const timer = setTimeout(() => cleanup(new Error('timeout')), 30000);
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

  async requestSources(sources: string[] = ['UserDatabases']): Promise<Buffer> {
    await this._send({ Sources: sources });
    const res = await this._recv();
    if (res.Status !== 'Acknowledged') throw new Error(res.Error ?? `file_relay error: ${JSON.stringify(res)}`);
    const chunks: Buffer[] = [];
    while (true) {
      const chunk = await new Promise<Buffer | null>((resolve) => {
        const onData = (d: Buffer) => { cleanup(); resolve(d); };
        const onEnd = () => { cleanup(); resolve(null); };
        const cleanup = () => { this.socket.removeListener('data', onData); this.socket.removeListener('end', onEnd); this.socket.removeListener('close', onEnd); };
        this.socket.once('data', onData);
        this.socket.once('end', onEnd);
        this.socket.once('close', onEnd);
      });
      if (!chunk || chunk.length === 0) break;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

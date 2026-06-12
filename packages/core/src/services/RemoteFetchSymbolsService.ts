import net from 'net';
import plist from 'plist';

export interface DscFile {
  filePath: string;
  fileSize: number;
}

export class RemoteFetchSymbolsService {
  static readonly SERVICE_NAME = 'com.apple.dt.remoteFetchSymbols';

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

  async getDscFileList(): Promise<DscFile[]> {
    const r = await this.sendRecv({ DSCFilePaths: [] });
    const count = r.DSCFilePaths as number;
    const files: DscFile[] = [];
    for (let i = 0; i < count; i++) {
      const resp = await this._recv();
      const entry = resp.DSCFilePaths as Record<string, any>;
      files.push({ filePath: entry.filePath, fileSize: entry.fileTransfer?.expectedLength ?? 0 });
    }
    return files;
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

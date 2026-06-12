import net from 'net';
import plist from 'plist';

export class DtFetchSymbolsService {
  static readonly SERVICE_NAME = 'com.apple.dt.fetchsymbols';
  private static readonly MAX_CHUNK = 10 * 1024 * 1024;
  private static readonly CMD_LIST = Buffer.from([0x30, 0x30, 0x30, 0x30]);
  private static readonly CMD_GET = Buffer.from([0x00, 0x00, 0x00, 0x01]);

  constructor(private socket: net.Socket) {}

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

  private async _startCommand(cmd: Buffer): Promise<void> {
    await new Promise<void>((res, rej) => this.socket.write(cmd, e => e ? rej(e) : res()));
    const ack = await this._readExactly(cmd.length);
    if (!ack.equals(cmd)) throw new Error('bad ack');
  }

  async listFiles(): Promise<string[]> {
    await this._startCommand(DtFetchSymbolsService.CMD_LIST);
    const lenBuf = await this._readExactly(4);
    const data = await this._readExactly(lenBuf.readUInt32BE(0));
    const r = plist.parse(data.toString('utf8')) as Record<string, any>;
    return r.files ?? [];
  }

  async getFile(fileNo: number, onChunk: (chunk: Buffer) => void, maxBytes?: number): Promise<void> {
    await this._startCommand(DtFetchSymbolsService.CMD_GET);
    const idx = Buffer.alloc(4);
    idx.writeUInt32BE(fileNo, 0);
    await new Promise<void>((res, rej) => this.socket.write(idx, e => e ? rej(e) : res()));
    const sizeBuf = await this._readExactly(8);
    const total = Number(sizeBuf.readBigUInt64BE(0));
    const limit = maxBytes != null ? Math.min(total, maxBytes) : total;
    let received = 0;
    while (received < limit) {
      const chunkSize = Math.min(limit - received, DtFetchSymbolsService.MAX_CHUNK);
      const chunk = await this._readExactly(chunkSize);
      onChunk(chunk);
      received += chunk.length;
    }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

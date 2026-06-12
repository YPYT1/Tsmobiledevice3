import net from 'net';
import plist from 'plist';

/**
 * WebKit Inspector session over the webinspector service socket.
 * Sends __selector / __argument plist messages, receives replies.
 */
export class InspectorSession {
  private msgQueue: Record<string, any>[] = [];
  private waiters: Array<(v: Record<string, any>) => void> = [];
  private readBuf = Buffer.alloc(0);

  constructor(private socket: net.Socket) {
    socket.on('data', (chunk: Buffer) => this._onData(chunk));
  }

  private _onData(chunk: Buffer): void {
    this.readBuf = Buffer.concat([this.readBuf, chunk]);
    while (true) {
      if (this.readBuf.length < 4) break;
      const size = this.readBuf.readUInt32BE(0);
      if (this.readBuf.length < 4 + size) break;
      const payload = this.readBuf.subarray(4, 4 + size);
      this.readBuf = this.readBuf.subarray(4 + size);
      try {
        const msg = plist.parse(payload.toString('utf8')) as Record<string, any>;
        if (this.waiters.length > 0) this.waiters.shift()!(msg);
        else this.msgQueue.push(msg);
      } catch { /* ignore */ }
    }
  }

  private async _recv(): Promise<Record<string, any>> {
    if (this.msgQueue.length > 0) return this.msgQueue.shift()!;
    return new Promise(resolve => this.waiters.push(resolve));
  }

  async send(selector: string, argument: Record<string, any>): Promise<void> {
    const xml = plist.build({ __selector: selector, __argument: argument } as any);
    const payload = Buffer.from(xml, 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
  }

  async sendRecv(selector: string, argument: Record<string, any>): Promise<Record<string, any>> {
    await this.send(selector, argument);
    return this._recv();
  }

  async *messages(): AsyncGenerator<Record<string, any>> {
    while (true) yield await this._recv();
  }

  async close(): Promise<void> { this.socket.destroy(); }
}

import net from 'net';
import plist from 'plist';
import { readExactly } from '../utils/socket';

export class NotificationProxy {
  private socket: net.Socket;

  constructor(socket: net.Socket) {
    this.socket = socket;
  }

  private async _send(msg: object): Promise<void> {
    const xml = plist.build(msg as any);
    const payload = Buffer.from(xml, 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((resolve, reject) =>
      this.socket.write(Buffer.concat([len, payload]), (err) => err ? reject(err) : resolve())
    );
  }

  private async _recv(): Promise<any> {
    const lenBuf = await readExactly(this.socket, 4);
    const payload = await readExactly(this.socket, lenBuf.readUInt32BE(0));
    return plist.parse(payload.toString('utf8'));
  }

  async postNotification(name: string): Promise<void> {
    await this._send({ Command: 'PostNotification', Name: name });
  }

  async observeNotification(name: string): Promise<void> {
    await this._send({ Command: 'ObserveNotification', Name: name });
  }

  async *notifications(signal?: AbortSignal): AsyncGenerator<string> {
    while (!signal?.aborted) {
      const msg = await this._recv();
      if (signal?.aborted) break;
      if (msg && msg.Name) yield msg.Name as string;
    }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

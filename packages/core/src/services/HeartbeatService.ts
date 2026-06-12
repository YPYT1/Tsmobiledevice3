import net from 'net';
import plist from 'plist';
import { readExactly } from '../utils/socket';

export class HeartbeatService {
  static readonly SERVICE_NAME = 'com.apple.mobile.heartbeat';
  static readonly RSD_SERVICE_NAME = 'com.apple.mobile.heartbeat.shim.remote';

  private _stopped = false;

  constructor(private socket: net.Socket) {}

  private async sendRecv(msg: Record<string, any>): Promise<Record<string, any>> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    return this._recv();
  }

  private async _recv(): Promise<Record<string, any>> {
    const lenBuf = await readExactly(this.socket, 4);
    const payload = await readExactly(this.socket, lenBuf.readUInt32BE(0));
    return plist.parse(payload.toString('utf8')) as Record<string, any>;
  }

  /** Respond to Marco/Polo until stop() is called or intervalMs elapses. */
  async start(intervalMs?: number): Promise<void> {
    const deadline = intervalMs != null ? Date.now() + intervalMs : Infinity;
    while (!this._stopped && Date.now() < deadline) {
      const msg = await this._recv();
      if (this._stopped) break;
      if (msg.Command === 'Marco') {
        await this.sendRecv({ Command: 'Polo' });
      }
    }
  }

  stop(): void {
    this._stopped = true;
    this.socket.destroy();
  }

  async close(): Promise<void> {
    this.stop();
  }
}

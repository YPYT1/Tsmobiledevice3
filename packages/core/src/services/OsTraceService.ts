import net from 'net';
import plist from 'plist';
import { readExactly } from '../utils/socket';

export interface OsTraceEntry {
  timestamp: Date;
  pid: number;
  tid: number;
  level: string;
  subsystem: string;
  category: string;
  message: string;
}

export class OsTraceService {
  static readonly SERVICE_NAME = 'com.apple.os_trace_relay';

  constructor(private socket: net.Socket) {}

  private async _send(msg: Record<string, any>): Promise<void> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
  }

  private async _recv(timeoutMs = 10000): Promise<Record<string, any>> {
    const lenBuf = await readExactly(this.socket, 4, timeoutMs);
    const data = await readExactly(this.socket, lenBuf.readUInt32BE(0), timeoutMs);
    return plist.parse(data.toString('utf8')) as Record<string, any>;
  }

  async *syslog(signal?: AbortSignal): AsyncGenerator<Record<string, any>> {
    await this._send({ Request: 'StartActivity', EnableDebug: true });
    await this._recv();  // consume header response (10s timeout)
    while (!signal?.aborted) {
      const entry = await this._recv(60000); // streaming: 60s between messages
      if (signal?.aborted) break;
      if (!entry || entry.Request === 'Stopped') break;
      yield entry;
    }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

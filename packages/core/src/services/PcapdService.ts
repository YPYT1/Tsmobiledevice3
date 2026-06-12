import * as net from 'net';
import plist from 'plist';
import * as bplistParser from 'bplist-parser';
import { readExactly } from '../utils/socket';

// PCAP global header
const PCAP_GLOBAL_HEADER = Buffer.from([
  0xd4, 0xc3, 0xb2, 0xa1,
  0x02, 0x00, 0x04, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0xff, 0xff, 0x00, 0x00,
  0xe9, 0x03, 0x00, 0x00,
]);

export class PcapdService {
  static readonly SERVICE_NAME = 'com.apple.pcapd';

  constructor(private socket: net.Socket) {}

  private async _send(msg: Record<string, any>): Promise<void> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
  }

  private async _recvPacket(): Promise<Buffer> {
    const lenBuf = await readExactly(this.socket, 4, 30000);
    return readExactly(this.socket, lenBuf.readUInt32BE(0), 30000);
  }

  pcapGlobalHeader(): Buffer {
    return PCAP_GLOBAL_HEADER;
  }

  async *packets(signal?: AbortSignal): AsyncGenerator<{ data: Record<string, any>; raw: Buffer }> {
    await this._send({ Command: 'StartCapture' });
    while (!signal?.aborted) {
      const raw = await this._recvPacket();
      if (signal?.aborted) break;
      let data: Record<string, any>;
      if (raw.length >= 6 && raw.subarray(0, 6).toString('ascii') === 'bplist') {
        const parsed = bplistParser.parseBuffer(raw);
        data = (parsed[0] ?? {}) as Record<string, any>;
      } else {
        data = plist.parse(raw.toString('utf8')) as Record<string, any>;
      }
      yield { data, raw };
    }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

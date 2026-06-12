import net from 'net';
import plist from 'plist';
import * as bplistParser from 'bplist-parser';

// PCAP global header
const PCAP_GLOBAL_HEADER = Buffer.from([
  0xd4, 0xc3, 0xb2, 0xa1, // magic number
  0x02, 0x00, 0x04, 0x00, // version 2.4
  0x00, 0x00, 0x00, 0x00, // GMT offset
  0x00, 0x00, 0x00, 0x00, // accuracy of timestamps
  0xff, 0xff, 0x00, 0x00, // max packet length
  0xe9, 0x03, 0x00, 0x00, // EN10MB (Ethernet) / 0x3e9 = raw IP
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

  private async _recvPacket(): Promise<Buffer> {
    const lenBuf = await this._readExactly(4);
    return this._readExactly(lenBuf.readUInt32BE(0));
  }

  pcapGlobalHeader(): Buffer {
    return PCAP_GLOBAL_HEADER;
  }

  async *packets(): AsyncGenerator<{ data: Record<string, any>; raw: Buffer }> {
    await this._send({ Command: 'StartCapture' });
    while (true) {
      const raw = await this._recvPacket();
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

import * as net from 'net';

export class SimulateLocationService {
  constructor(private socket: net.Socket) {}

  async setLocation(lat: number, lng: number): Promise<void> {
    const latStr = String(lat);
    const lngStr = String(lng);
    const buf = Buffer.alloc(4 + 4 + latStr.length + 4 + lngStr.length);
    let offset = 0;
    buf.writeUInt32BE(0, offset); offset += 4;
    buf.writeUInt32BE(latStr.length, offset); offset += 4;
    buf.write(latStr, offset, 'utf8'); offset += latStr.length;
    buf.writeUInt32BE(lngStr.length, offset); offset += 4;
    buf.write(lngStr, offset, 'utf8');
    await this.write(buf);
  }

  async resetLocation(): Promise<void> {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(1, 0);
    await this.write(buf);
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }

  private write(buf: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(buf, (err) => (err ? reject(err) : resolve()));
    });
  }
}

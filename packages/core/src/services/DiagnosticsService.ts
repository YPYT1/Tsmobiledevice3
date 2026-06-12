import net from 'net';
import plist from 'plist';

export class DiagnosticsService {
  static readonly SERVICE_NAME = 'com.apple.mobile.diagnostics_relay';

  constructor(private socket: net.Socket) {}

  private async sendRecv(request: Record<string, any>): Promise<Record<string, any>> {
    const xml = plist.build(request);
    const payload = Buffer.from(xml, 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(payload.length, 0);
    await new Promise<void>((resolve, reject) =>
      this.socket.write(Buffer.concat([lenBuf, payload]), (err) => (err ? reject(err) : resolve()))
    );
    return this.recv();
  }

  private async recv(): Promise<Record<string, any>> {
    const lenBuf = await this.readExactly(4);
    const size = lenBuf.readUInt32BE(0);
    const payload = await this.readExactly(size);
    return plist.parse(payload.toString('utf8')) as Record<string, any>;
  }

  private readExactly(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error('recv timeout')), 10000);
      const tryRead = () => {
        while (received < size) {
          const chunk = sock.read(size - received) as Buffer | null;
          if (!chunk) break;
          chunks.push(chunk);
          received += chunk.length;
        }
        if (received >= size) {
          clearTimeout(timer);
          sock.removeListener('readable', tryRead);
          sock.removeListener('error', onError);
          sock.removeListener('close', onClose);
          resolve(Buffer.concat(chunks).subarray(0, size));
        }
      };
      const onError = (e: Error) => cleanup(e);
      const onClose = () => cleanup(new Error('Socket closed'));
      const cleanup = (err: Error) => {
        clearTimeout(timer);
        sock.removeListener('readable', tryRead);
        sock.removeListener('error', onError);
        sock.removeListener('close', onClose);
        reject(err);
      };
      sock.on('readable', tryRead);
      sock.once('error', onError);
      sock.once('close', onClose);
      tryRead();
    });
  }

  async queryIORegistry(plane?: string, name?: string, ioClass?: string): Promise<any> {
    const req: Record<string, any> = { Request: 'IORegistry' };
    if (plane) req['CurrentPlane'] = plane;
    if (name) req['EntryName'] = name;
    if (ioClass) req['EntryClass'] = ioClass;
    const response = await this.sendRecv(req);
    if (response['Status'] !== 'Success') throw new Error(`IORegistry failed: ${JSON.stringify(response)}`);
    return response['Diagnostics']?.['IORegistry'] ?? null;
  }

  async getBattery(): Promise<Record<string, any>> {
    return this.queryIORegistry(undefined, undefined, 'IOPMPowerSource');
  }

  private async action(action: string): Promise<void> {
    const response = await this.sendRecv({ Request: action });
    if (response['Status'] !== 'Success') throw new Error(`Action ${action} failed: ${JSON.stringify(response)}`);
  }

  async restart(): Promise<void> {
    await this.action('Restart');
  }

  async shutdown(): Promise<void> {
    await this.action('Shutdown');
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

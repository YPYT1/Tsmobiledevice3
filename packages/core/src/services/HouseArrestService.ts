import net from 'net';
import plist from 'plist';
import { AfcService } from './AfcService';

export class HouseArrestService extends AfcService {
  static readonly SERVICE_NAME = 'com.apple.mobile.house_arrest';
  static readonly RSD_SERVICE_NAME = 'com.apple.mobile.house_arrest.shim.remote';

  static async open(socket: net.Socket, bundleId: string, documentsOnly = false): Promise<HouseArrestService> {
    const svc = new HouseArrestService(socket);
    const cmd = documentsOnly ? 'VendDocuments' : 'VendContainer';
    const resp = await svc._command(bundleId, cmd);
    if (resp.Error) throw new Error(resp.Error === 'ApplicationLookupFailed' ? `App not found: ${bundleId}` : resp.Error);
    return svc;
  }

  private async _command(bundleId: string, cmd: string): Promise<Record<string, any>> {
    const payload = Buffer.from(plist.build({ Command: cmd, Identifier: bundleId }), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    const lenBuf = await this._readPlist(4);
    const data = await this._readPlist(lenBuf.readUInt32BE(0));
    return plist.parse(data.toString('utf8')) as Record<string, any>;
  }

  private _readPlist(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error('timeout')), 10000);
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
}

import net from 'net';
import plist from 'plist';
import * as bplistParser from 'bplist-parser';
import { MuxException } from '../exceptions';

export class AppInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppInstallError';
  }
}

export class InstallationProxy {
  static readonly SERVICE_NAME = 'com.apple.mobile.installation_proxy';
  static readonly RSD_SERVICE_NAME = 'com.apple.mobile.installation_proxy.shim.remote';

  constructor(private socket: net.Socket) {}

  private _write(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  private _readExactly(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error('InstallationProxy recv timeout')), 30000);

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

      const onError = (e: Error) => cleanup(new MuxException(`Socket error: ${e.message}`));
      const onClose = () => cleanup(new MuxException('Socket closed'));

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

  private async _send(msg: Record<string, any>): Promise<void> {
    const xml = plist.build(msg);
    const payload = Buffer.from(xml, 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(payload.length, 0);
    await this._write(Buffer.concat([lenBuf, payload]));
  }

  private async _recv(): Promise<Record<string, any>> {
    const lenBuf = await this._readExactly(4);
    const size = lenBuf.readUInt32BE(0);
    const payload = await this._readExactly(size);
    // binary plist magic: 62 70 6c 69 73 74 ("bplist")
    if (payload.length >= 6 && payload.subarray(0, 6).toString('ascii') === 'bplist') {
      const result = bplistParser.parseBuffer(payload);
      return (result[0] ?? {}) as Record<string, any>;
    }
    return plist.parse(payload.toString('utf8')) as Record<string, any>;
  }

  private async _waitForComplete(): Promise<void> {
    while (true) {
      const resp = await this._recv();
      if (resp.Error) {
        throw new AppInstallError(resp.ErrorDescription || resp.Error);
      }
      if (resp.Status === 'Complete') return;
    }
  }

  async getApps(appType: 'User' | 'System' | 'Any' = 'Any'): Promise<Record<string, any>> {
    await this._send({
      Command: 'Lookup',
      ClientOptions: { ApplicationType: appType },
    });
    const resp = await this._recv();
    return (resp.LookupResult as Record<string, any>) || {};
  }

  async install(packagePath: string): Promise<void> {
    await this._send({
      Command: 'Install',
      PackagePath: packagePath,
      ClientOptions: { PackageType: 'Developer' },
    });
    await this._waitForComplete();
  }

  async uninstall(bundleId: string): Promise<void> {
    await this._send({
      Command: 'Uninstall',
      ApplicationIdentifier: bundleId,
      ClientOptions: {},
    });
    await this._waitForComplete();
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

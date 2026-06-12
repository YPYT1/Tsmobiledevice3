import net from 'net';
import plist from 'plist';

export class MobileConfigService {
  static readonly SERVICE_NAME = 'com.apple.mobile.MCInstall';
  static readonly RSD_SERVICE_NAME = 'com.apple.mobile.MCInstall.shim.remote';

  constructor(private socket: net.Socket) {}

  private async sendRecv(msg: Record<string, any>): Promise<Record<string, any>> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    return this._recv();
  }

  private async _recv(): Promise<Record<string, any>> {
    const lenBuf = await this._readExactly(4);
    const data = await this._readExactly(lenBuf.readUInt32BE(0));
    return plist.parse(data.toString('utf8')) as Record<string, any>;
  }

  private _readExactly(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error('timeout')), 15000);
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

  private async _send(req: Record<string, any>): Promise<Record<string, any>> {
    const r = await this.sendRecv(req);
    if (r.Status !== 'Acknowledged') {
      const code = r.ErrorChain?.[0]?.ErrorCode;
      throw Object.assign(new Error(`MCInstall error (${code}): ${JSON.stringify(r)}`), { code });
    }
    return r;
  }

  async getProfileList(): Promise<Record<string, any>> {
    return this._send({ RequestType: 'GetProfileList' });
  }

  async installProfile(payload: Buffer): Promise<void> {
    await this._send({ RequestType: 'InstallProfile', Payload: payload });
  }

  async removeProfile(identifier: string): Promise<void> {
    const profiles = await this.getProfileList();
    const meta = profiles.ProfileMetadata?.[identifier];
    if (!meta) return;
    const data = Buffer.from(plist.build({
      PayloadType: 'Configuration',
      PayloadIdentifier: identifier,
      PayloadUUID: meta.PayloadUUID,
      PayloadVersion: meta.PayloadVersion,
    }), 'utf8');
    await this._send({ RequestType: 'RemoveProfile', ProfileIdentifier: data });
  }

  async getCloudConfiguration(): Promise<Record<string, any>> {
    const r = await this._send({ RequestType: 'GetCloudConfiguration' });
    return r.CloudConfiguration;
  }

  async setCloudConfiguration(config: Record<string, any>): Promise<void> {
    await this._send({ RequestType: 'SetCloudConfiguration', CloudConfiguration: config });
  }

  async getStoredProfile(): Promise<Record<string, any>> {
    return this._send({ RequestType: 'GetStoredProfile', Purpose: 'PostSetupInstallation' });
  }

  async eraseDevice(preserveDataPlan = false, disallowProximitySetup = false): Promise<void> {
    try { await this._send({ RequestType: 'EraseDevice', PreserveDataPlan: preserveDataPlan, DisallowProximitySetup: disallowProximitySetup }); } catch { /* device disconnects */ }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

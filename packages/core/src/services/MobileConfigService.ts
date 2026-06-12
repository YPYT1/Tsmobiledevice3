import net from 'net';
import plist from 'plist';
import { readExactly } from '../utils/socket';

export interface ConfigProfileInfo {
  identifier: string;
  displayName?: string;
  version?: number;
  uuid?: string;
}

export class MobileConfigService {
  static readonly SERVICE_NAME = 'com.apple.mobile.MCInstall';
  static readonly RSD_SERVICE_NAME = 'com.apple.mobile.MCInstall.shim.remote';

  constructor(private socket: net.Socket) {}

  private async sendRecv(msg: Record<string, any>): Promise<Record<string, any>> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    const lenBuf = await readExactly(this.socket, 4, 15000);
    const data = await readExactly(this.socket, lenBuf.readUInt32BE(0), 15000);
    return plist.parse(data.toString('utf8')) as Record<string, any>;
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

  /** Structured list of installed configuration profiles. */
  async listProfiles(): Promise<ConfigProfileInfo[]> {
    const r = await this.getProfileList();
    const meta = r.ProfileMetadata ?? {};
    return Object.entries(meta).map(([identifier, m]: [string, any]) => ({
      identifier,
      displayName: m.PayloadDisplayName,
      version: m.PayloadVersion,
      uuid: m.PayloadUUID,
    }));
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
    return (await this._send({ RequestType: 'GetCloudConfiguration' })).CloudConfiguration;
  }

  async setCloudConfiguration(config: Record<string, any>): Promise<void> {
    await this._send({ RequestType: 'SetCloudConfiguration', CloudConfiguration: config });
  }

  async getStoredProfile(purpose = 'PostSetupInstallation'): Promise<Record<string, any>> {
    return this._send({ RequestType: 'GetStoredProfile', Purpose: purpose });
  }

  async eraseDevice(preserveDataPlan = false, disallowProximitySetup = false): Promise<void> {
    try { await this._send({ RequestType: 'EraseDevice', PreserveDataPlan: preserveDataPlan, DisallowProximitySetup: disallowProximitySetup }); } catch { /* device disconnects */ }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

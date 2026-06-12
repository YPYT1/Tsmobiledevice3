import net from 'net';
import plist from 'plist';
import { readExactly } from '../utils/socket';

export interface ProvisioningProfile {
  name: string;
  uuid: string;
  bundleId: string;
  teamName?: string;
  expirationDate?: Date | null;
}

export class MisagentService {
  static readonly SERVICE_NAME = 'com.apple.misagent';
  static readonly RSD_SERVICE_NAME = 'com.apple.misagent.shim.remote';

  constructor(private socket: net.Socket) {}

  private async sendRecv(msg: Record<string, any>): Promise<Record<string, any>> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    const lenBuf = await readExactly(this.socket, 4);
    const data = await readExactly(this.socket, lenBuf.readUInt32BE(0));
    return plist.parse(data.toString('utf8')) as Record<string, any>;
  }

  async install(profileData: Buffer): Promise<Record<string, any>> {
    const r = await this.sendRecv({ MessageType: 'Install', Profile: profileData, ProfileType: 'Provisioning' });
    if (r.Status) throw new Error(`misagent install error: ${JSON.stringify(r)}`);
    return r;
  }

  async remove(profileId: string): Promise<Record<string, any>> {
    const r = await this.sendRecv({ MessageType: 'Remove', ProfileID: profileId, ProfileType: 'Provisioning' });
    if (r.Status) throw new Error(`misagent remove error: ${JSON.stringify(r)}`);
    return r;
  }

  async copyAll(): Promise<Buffer[]> {
    const r = await this.sendRecv({ MessageType: 'CopyAll', ProfileType: 'Provisioning' });
    if (r.Status) throw new Error(`misagent copyAll error: ${JSON.stringify(r)}`);
    return (r.Payload as Buffer[]) ?? [];
  }

  /** Parse .mobileprovision buffers and return structured profile info. */
  async listProfiles(): Promise<ProvisioningProfile[]> {
    const raw = await this.copyAll();
    return raw.flatMap((buf) => {
      // .mobileprovision = PKCS7 wrapper; extract embedded XML plist
      const str = buf.toString('binary');
      const start = str.indexOf('<?xml');
      const end = str.indexOf('</plist>');
      if (start === -1 || end === -1) return [];
      try {
        const p = plist.parse(buf.slice(start, end + 8).toString('utf8')) as any;
        return [{
          name: p.Name ?? '',
          uuid: p.UUID ?? '',
          bundleId: String(p.Entitlements?.['application-identifier'] ?? '').replace(/^[^.]+\./, ''),
          teamName: p.TeamName ?? undefined,
          expirationDate: p.ExpirationDate ?? null,
        }];
      } catch { return []; }
    });
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

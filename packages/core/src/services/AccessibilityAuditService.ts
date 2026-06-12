import net from 'net';
import plist from 'plist';
import { readExactly } from '../utils/socket';

export enum AuditType {
  ElementIssues     = 'ElementIssues',
  HitRegionIssues   = 'HitRegionIssues',
  ContrastIssues    = 'ContrastIssues',
  ParentChildIssues = 'ParentChildIssues',
  MetadataIssues    = 'MetadataIssues',
}

export class AccessibilityAuditService {
  static readonly SERVICE_NAME = 'com.apple.accessibility.axauditd';
  static readonly RSD_SERVICE_NAME = 'com.apple.accessibility.axauditd.shim.remote';

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

  async getCapabilities(): Promise<Record<string, any>> {
    return this.sendRecv({ MessageName: 'GetCapabilities' });
  }

  async runAudit(bundleId: string, types?: AuditType[]): Promise<Record<string, any>> {
    const msg: Record<string, any> = { MessageName: 'RunAudit', TargetBundleID: bundleId };
    if (types) msg.AuditTypes = types;
    return this.sendRecv(msg);
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

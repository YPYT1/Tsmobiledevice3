import net from 'net';
import plist from 'plist';
import { DeviceLinkService } from './DeviceLinkService';

export class MobileBackup2Service extends DeviceLinkService {
  static readonly SERVICE_NAME = 'com.apple.mobilebackup2';

  static async create(socket: net.Socket): Promise<MobileBackup2Service> {
    const svc = new MobileBackup2Service(socket);
    await svc.versionExchange(410, 0);
    return svc;
  }

  async sendRequest(msg: Record<string, any>): Promise<void> {
    await this.sendProcessMessage(msg);
  }

  async recvMessage(): Promise<Record<string, any>> {
    return this.recvProcessMessage();
  }

  async backup(udid: string): Promise<void> {
    await this.sendProcessMessage({ MessageName: 'Backup', TargetIdentifier: udid });
  }

  async restore(udid: string, options: Record<string, any> = {}): Promise<void> {
    await this.sendProcessMessage({ MessageName: 'Restore', TargetIdentifier: udid, ...options });
  }

  async info(udid: string): Promise<Record<string, any>> {
    await this.sendProcessMessage({ MessageName: 'Info', TargetIdentifier: udid });
    return this.recvProcessMessage();
  }

  async list(udid: string): Promise<Record<string, any>> {
    await this.sendProcessMessage({ MessageName: 'List', TargetIdentifier: udid });
    return this.recvProcessMessage();
  }
}

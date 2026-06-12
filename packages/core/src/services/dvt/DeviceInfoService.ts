import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class DeviceInfoService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.deviceinfo';
  constructor(private ch: DtxChannel) {}

  async ls(path: string): Promise<string[]> {
    return await this.ch.invoke('directoryListingForPath:', [path]) ?? [];
  }

  async proclist(): Promise<any[]> {
    return await this.ch.invoke('runningProcesses') ?? [];
  }

  async isRunningPid(pid: number): Promise<boolean> {
    return await this.ch.invoke('isRunningPid:', [pid]) ?? false;
  }

  async systemInformation(): Promise<Record<string, any>> {
    return await this.ch.invoke('systemInformation') ?? {};
  }

  async hardwareInformation(): Promise<Record<string, any>> {
    return await this.ch.invoke('hardwareInformation') ?? {};
  }

  async networkInformation(): Promise<Record<string, any>> {
    return await this.ch.invoke('networkInformation') ?? {};
  }

  async machTimeInfo(): Promise<Record<string, any>> {
    return await this.ch.invoke('machTimeInfo') ?? {};
  }

  async sysmonProcessAttributes(): Promise<string[]> {
    return await this.ch.invoke('sysmonProcessAttributes') ?? [];
  }

  async sysmonSystemAttributes(): Promise<string[]> {
    return await this.ch.invoke('sysmonSystemAttributes') ?? [];
  }

  async traceCodes(): Promise<Record<number, string>> {
    const raw: string = await this.ch.invoke('traceCodesFile') ?? '';
    const result: Record<number, string> = {};
    for (const line of raw.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) result[parseInt(parts[0], 16)] = parts[1];
    }
    return result;
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<DeviceInfoService> {
    const ch = await dvt.openChannel(DeviceInfoService.IDENTIFIER);
    return new DeviceInfoService(ch);
  }
}

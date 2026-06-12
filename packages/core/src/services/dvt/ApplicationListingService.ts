import { DvtServiceProvider } from '../../dtx/provider';
import { DtxChannel } from '../../dtx/provider';

export interface AppInfo {
  bundleIdentifier: string;
  name?: string;
  version?: string;
  [key: string]: any;
}

export class ApplicationListingService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.device.applictionListing';

  constructor(private ch: DtxChannel) {}

  async applist(): Promise<AppInfo[]> {
    return await this.ch.invoke('installedApplicationsMatching:registerUpdateToken:', [{}, '']) ?? [];
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<ApplicationListingService> {
    const ch = await dvt.openChannel(ApplicationListingService.IDENTIFIER);
    return new ApplicationListingService(ch);
  }
}

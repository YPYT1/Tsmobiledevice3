import { DvtServiceProvider } from '../../dtx/provider';

export class ApplicationListingService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.device.applictionListing';

  constructor(private ch: import('../../dtx/provider').DtxChannel) {}

  async applist(): Promise<any[]> {
    return await this.ch.invoke('installedApplicationsMatching:registerUpdateToken:', [{}, '']) ?? [];
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<ApplicationListingService> {
    const ch = await dvt.openChannel(ApplicationListingService.IDENTIFIER);
    return new ApplicationListingService(ch);
  }
}

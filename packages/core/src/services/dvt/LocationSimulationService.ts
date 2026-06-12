import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class LocationSimulationService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.LocationSimulation';

  constructor(private ch: DtxChannel) {}

  async setLocation(lat: number, lng: number): Promise<void> {
    await this.ch.invoke('simulateLocationWithLatitude:longitude:', [lat, lng]);
  }

  async resetLocation(): Promise<void> {
    await this.ch.invoke('stopLocationSimulation', [], false);
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<LocationSimulationService> {
    const ch = await dvt.openChannel(LocationSimulationService.IDENTIFIER);
    return new LocationSimulationService(ch);
  }
}

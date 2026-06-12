import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class EnergyMonitorService {
  static readonly IDENTIFIER = 'com.apple.xcode.debug-gauge-data-providers.Energy';

  constructor(private ch: DtxChannel) {}

  async start(pids: number[]): Promise<void> {
    await this.ch.invoke('stopSamplingForPIDs:', [pids], false);
    await this.ch.invoke('startSamplingForPIDs:', [pids], false);
  }

  async stop(pids: number[]): Promise<void> {
    await this.ch.invoke('stopSamplingForPIDs:', [pids], false);
  }

  async sample(pids: number[]): Promise<any> {
    return this.ch.invoke('sampleAttributes:forPIDs:', [{}, pids]);
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<EnergyMonitorService> {
    const ch = await dvt.openChannel(EnergyMonitorService.IDENTIFIER);
    return new EnergyMonitorService(ch);
  }
}

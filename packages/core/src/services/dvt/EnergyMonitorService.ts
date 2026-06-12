import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export interface EnergySample {
  pid: number;
  energy?: Record<string, number>;
  [key: string]: any;
}

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

  /** Single sample for a set of PIDs. */
  async sample(pids: number[]): Promise<EnergySample[]> {
    return this.ch.invoke('sampleAttributes:forPIDs:', [{}, pids]);
  }

  /** Stream samples — yields after each channel message. Call start() first. */
  async *samples(): AsyncGenerator<EnergySample[]> {
    while (true) {
      const { selector, args } = await this.ch.recv();
      if (selector === '__closed__') break;
      if (args.length > 0) yield args[0] as EnergySample[];
    }
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<EnergyMonitorService> {
    const ch = await dvt.openChannel(EnergyMonitorService.IDENTIFIER);
    return new EnergyMonitorService(ch);
  }
}

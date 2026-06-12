import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class SysmontapService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.sysmontap';
  static readonly DEFAULT_INTERVAL_MS = 500;

  constructor(private ch: DtxChannel) {}

  async start(
    processAttrs: string[],
    systemAttrs: string[],
    intervalMs = SysmontapService.DEFAULT_INTERVAL_MS,
  ): Promise<void> {
    await this.ch.invoke('setConfig:', [{
      ur: 1,
      bm: 0,
      procAttrs: processAttrs,
      sysAttrs: systemAttrs,
      cpuUsage: true,
      physFootprint: true,
      sampleInterval: intervalMs * 1_000_000,
    }], false);
    await this.ch.invoke('start', [], false);
    // consume ack
    await this.ch.recv();
  }

  async *samples(): AsyncGenerator<Record<string, any>> {
    while (true) {
      const { selector, args } = await this.ch.recv();
      if (selector === '__closed__') break;
      if (args.length > 0) yield args[0] as Record<string, any>;
    }
  }

  async stop(): Promise<void> {
    await this.ch.invoke('stop', [], false);
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<SysmontapService> {
    const ch = await dvt.openChannel(SysmontapService.IDENTIFIER);
    return new SysmontapService(ch);
  }
}

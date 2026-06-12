import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class CoreProfileSessionTapService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.coreprofilesessiontap';

  constructor(private ch: DtxChannel) {}

  async start(config: Record<string, any> = {}): Promise<void> {
    const defaultConfig = {
      'tc': [{ 'kdf2': 0, 'trp': 0, 'kdi2': 0, 'tk': 3, 'sid': 0 }],
      'rp': 100,
      'bm': 0,
      'ur': 500,
      'kd': [],
    };
    await this.ch.invoke('setConfig:', [{ ...defaultConfig, ...config }], false);
    await this.ch.invoke('start', [], false);
    await this.ch.recv(); // ack
  }

  async stop(): Promise<void> {
    await this.ch.invoke('stop', [], false);
  }

  async getStackshot(): Promise<Buffer | null> {
    const result = await this.ch.invoke('requestConsumption:', [{ 'stackshot': true }]);
    if (Buffer.isBuffer(result)) return result;
    return null;
  }

  async *chunks(): AsyncGenerator<Buffer> {
    while (true) {
      const { selector, args } = await this.ch.recv();
      if (selector === '__closed__') break;
      if (Buffer.isBuffer(args[0])) yield args[0];
    }
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<CoreProfileSessionTapService> {
    const ch = await dvt.openChannel(CoreProfileSessionTapService.IDENTIFIER);
    return new CoreProfileSessionTapService(ch);
  }
}

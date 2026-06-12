import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class ActivityTraceTapService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.activitytracetap';

  constructor(private ch: DtxChannel) {}

  async start(config: Record<string, any> = {}): Promise<void> {
    const defaultConfig = {
      'com.apple.dt.DTActivityTraceTap': {
        'diag-policy': [{ 'diag-policy-action': 1 }],
        'subsystems': [],
      },
    };
    await this.ch.invoke('setConfig:', [{ ...defaultConfig, ...config }], false);
    await this.ch.invoke('start', [], false);
    await this.ch.recv(); // ack
  }

  async stop(): Promise<void> {
    await this.ch.invoke('stop', [], false);
  }

  async *messages(): AsyncGenerator<any> {
    while (true) {
      const { selector, args } = await this.ch.recv();
      if (selector === '__closed__') break;
      if (args.length > 0) yield args[0];
    }
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<ActivityTraceTapService> {
    const ch = await dvt.openChannel(ActivityTraceTapService.IDENTIFIER);
    return new ActivityTraceTapService(ch);
  }
}

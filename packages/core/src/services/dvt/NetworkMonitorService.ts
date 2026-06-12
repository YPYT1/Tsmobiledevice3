import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class NetworkMonitorService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.networking';

  constructor(private ch: DtxChannel) {}

  async start(): Promise<void> {
    await this.ch.invoke('startMonitoring', [], false);
  }

  async stop(): Promise<void> {
    await this.ch.invoke('stopMonitoring', [], false);
  }

  async *events(): AsyncGenerator<any> {
    while (true) {
      const { selector, args } = await this.ch.recv();
      if (selector === '__closed__') break;
      yield { selector, args };
    }
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<NetworkMonitorService> {
    const ch = await dvt.openChannel(NetworkMonitorService.IDENTIFIER);
    return new NetworkMonitorService(ch);
  }
}

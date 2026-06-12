import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class NotificationsService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.mobilenotifications';

  constructor(private ch: DtxChannel) {}

  async start(): Promise<void> {
    await this.ch.invoke('setApplicationStateNotificationsEnabled:', [true], false);
    await this.ch.invoke('setMemoryNotificationsEnabled:', [true], false);
  }

  async stop(): Promise<void> {
    await this.ch.invoke('setApplicationStateNotificationsEnabled:', [false], false);
    await this.ch.invoke('setMemoryNotificationsEnabled:', [false], false);
  }

  async *events(): AsyncGenerator<any> {
    while (true) {
      const { selector, args } = await this.ch.recv();
      if (selector === '__closed__') break;
      yield { selector, args };
    }
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<NotificationsService> {
    const ch = await dvt.openChannel(NotificationsService.IDENTIFIER);
    return new NotificationsService(ch);
  }
}

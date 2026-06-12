import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class ConditionInducerService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.ConditionInducer';

  constructor(private ch: DtxChannel) {}

  async list(): Promise<any[]> {
    return await this.ch.invoke('availableConditionInducers') ?? [];
  }

  async set(profileIdentifier: string): Promise<void> {
    const groups: any[] = await this.list();
    for (const group of groups) {
      for (const profile of group.profiles ?? []) {
        if (profile.identifier === profileIdentifier) {
          await this.ch.invoke('enableConditionWithIdentifier:profileIdentifier:', [group.identifier, profile.identifier]);
          return;
        }
      }
    }
    throw new Error(`Unknown profile identifier: ${profileIdentifier}`);
  }

  async clear(): Promise<void> {
    await this.ch.invoke('disableActiveCondition', [], false);
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<ConditionInducerService> {
    const ch = await dvt.openChannel(ConditionInducerService.IDENTIFIER);
    return new ConditionInducerService(ch);
  }
}

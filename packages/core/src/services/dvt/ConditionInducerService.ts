import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export interface ConditionProfile {
  identifier: string;
  name?: string;
  description?: string;
}

export interface ConditionGroup {
  identifier: string;
  name?: string;
  profiles?: ConditionProfile[];
}

export class ConditionInducerService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.ConditionInducer';

  constructor(private ch: DtxChannel) {}

  async list(): Promise<ConditionGroup[]> {
    return await this.ch.invoke('availableConditionInducers') ?? [];
  }

  async getActive(): Promise<string | null> {
    return await this.ch.invoke('activeCondition') ?? null;
  }

  async set(profileIdentifier: string): Promise<void> {
    const groups = await this.list();
    for (const group of groups) {
      for (const profile of group.profiles ?? []) {
        if (profile.identifier === profileIdentifier) {
          await this.ch.invoke('enableConditionWithIdentifier:profileIdentifier:', [group.identifier, profile.identifier]);
          return;
        }
      }
    }
    throw new Error(`Unknown condition profile: ${profileIdentifier}`);
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

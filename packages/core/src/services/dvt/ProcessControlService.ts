import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class ProcessControlService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.processcontrol';

  constructor(private ch: DtxChannel) {}

  async launch(
    bundleId: string,
    args: string[] = [],
    env: Record<string, string> = {},
    killExisting = true,
    startSuspended = false,
    extraOptions: Record<string, any> = {},
  ): Promise<number> {
    const opts = { StartSuspendedKey: startSuspended, KillExisting: killExisting, ...extraOptions };
    return await this.ch.invoke(
      'launchSuspendedProcessWithDevicePath:bundleIdentifier:environment:arguments:options:',
      ['', bundleId, env, args, opts],
    ) ?? 0;
  }

  async kill(pid: number): Promise<void> {
    await this.ch.invoke('killPid:', [pid], false);
  }

  async signal(pid: number, sig: number): Promise<any> {
    return this.ch.invoke('sendSignal:toPid:', [sig, pid]);
  }

  async pidForBundleId(bundleId: string): Promise<number> {
    return await this.ch.invoke('processIdentifierForBundleIdentifier:', [bundleId]) ?? -1;
  }

  async *output(): AsyncGenerator<{ pid: number; message: string }> {
    while (true) {
      const { selector, args } = await this.ch.recv();
      if (selector === 'outputReceived:fromProcess:atTime:' && args.length >= 2) {
        yield { message: String(args[0] ?? ''), pid: Number(args[1] ?? 0) };
      }
      if (selector === '__closed__') break;
    }
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<ProcessControlService> {
    const ch = await dvt.openChannel(ProcessControlService.IDENTIFIER);
    return new ProcessControlService(ch);
  }
}

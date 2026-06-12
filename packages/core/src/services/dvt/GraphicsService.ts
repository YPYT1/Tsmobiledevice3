import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class GraphicsService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.graphics.opengl';

  constructor(private ch: DtxChannel) {}

  async start(interval = 0.0): Promise<void> {
    await this.ch.invoke('startSamplingAtTimeInterval:', [interval]);
  }

  async stop(): Promise<void> {
    await this.ch.invoke('stopSampling', [], false);
  }

  async *samples(): AsyncGenerator<any> {
    while (true) {
      const { selector, args } = await this.ch.recv();
      if (selector === '__closed__') break;
      if (args.length > 0) yield args[0];
    }
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<GraphicsService> {
    const ch = await dvt.openChannel(GraphicsService.IDENTIFIER);
    return new GraphicsService(ch);
  }
}

import { DvtServiceProvider, DtxChannel } from '../../dtx/provider';

export class ScreenshotDvtService {
  static readonly IDENTIFIER = 'com.apple.instruments.server.services.screenshot';

  constructor(private ch: DtxChannel) {}

  async takeScreenshot(): Promise<Buffer> {
    const result = await this.ch.invoke('takeScreenshot');
    if (Buffer.isBuffer(result)) return result;
    return Buffer.alloc(0);
  }

  async close(): Promise<void> { this.ch.close(); }

  static async create(dvt: DvtServiceProvider): Promise<ScreenshotDvtService> {
    const ch = await dvt.openChannel(ScreenshotDvtService.IDENTIFIER);
    return new ScreenshotDvtService(ch);
  }
}

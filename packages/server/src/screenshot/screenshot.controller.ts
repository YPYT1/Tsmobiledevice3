import { Controller, Get, Param, Res } from '@nestjs/common';
import { DevicesService } from '../devices/devices.service';

@Controller('devices')
export class ScreenshotController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get(':udid/screenshot')
  async getScreenshot(@Param('udid') udid: string, @Res() res: any) {
    const buf = await this.devicesService.withFactory(udid, async (factory) => {
      const svc = await factory.screenshot();
      try {
        return await svc.takeScreenshot();
      } finally {
        await svc.close();
      }
    });
    res.setHeader('Content-Type', 'image/png');
    res.send(buf);
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DevicesService } from '../devices/devices.service';

@ApiTags('devices')
@Controller('devices')
export class CrashController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get(':udid/crashes')
  async getCrashes(@Param('udid') udid: string) {
    return this.devicesService.withFactory(udid, async (factory) => {
      const svc = await factory.crashReports();
      try {
        return await svc.listCrashReports();
      } finally {
        await svc.close();
      }
    });
  }
}

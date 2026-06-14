import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DevicesService } from '../devices/devices.service';

@ApiTags('devices')
@Controller('devices')
export class AppsController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get(':udid/apps')
  async getApps(
    @Param('udid') udid: string,
    @Query('type') type: 'User' | 'System' | 'Any' = 'Any',
  ) {
    return this.devicesService.withFactory(udid, async (factory) => {
      const svc = await factory.installationProxy();
      try {
        return await svc.getApps(type);
      } finally {
        await svc.close();
      }
    });
  }
}

import { Controller, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DevicesService } from '../devices/devices.service';

@ApiTags('devices')
@Controller('devices')
export class LocationController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post(':udid/location')
  async setLocation(
    @Param('udid') udid: string,
    @Body() body: { lat: number; lng: number },
  ) {
    await this.devicesService.withFactory(udid, async (factory) => {
      const svc = await factory.simulateLocation();
      try {
        await svc.setLocation(body.lat, body.lng);
      } finally {
        await svc.close();
      }
    });
    return { ok: true };
  }

  @Delete(':udid/location')
  async resetLocation(@Param('udid') udid: string) {
    await this.devicesService.withFactory(udid, async (factory) => {
      const svc = await factory.simulateLocation();
      try {
        await svc.resetLocation();
      } finally {
        await svc.close();
      }
    });
    return { ok: true };
  }
}

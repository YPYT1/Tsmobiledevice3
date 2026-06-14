import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DevicesService } from './devices.service';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  getDevices() {
    return this.devicesService.getDevices();
  }

  @Get(':udid')
  async getDevice(@Param('udid') udid: string) {
    return this.devicesService.withFactory(udid, async (_, lockdown) => {
      return lockdown.getValue();
    });
  }

  @Get(':udid/battery')
  async getBattery(@Param('udid') udid: string) {
    return this.devicesService.withFactory(udid, async (factory) => {
      const svc = await factory.diagnostics();
      try {
        return await svc.getBattery();
      } finally {
        await svc.close();
      }
    });
  }
}

import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { ScreenshotController } from '../screenshot/screenshot.controller';
import { AppsController } from '../apps/apps.controller';
import { CrashController } from '../crash/crash.controller';
import { LocationController } from '../location/location.controller';
import { LogsGateway } from '../gateway/logs.gateway';
import { PerfGateway } from '../gateway/perf.gateway';

@Module({
  controllers: [
    DevicesController,
    ScreenshotController,
    AppsController,
    CrashController,
    LocationController,
  ],
  providers: [DevicesService, LogsGateway, PerfGateway],
})
export class DevicesModule {}

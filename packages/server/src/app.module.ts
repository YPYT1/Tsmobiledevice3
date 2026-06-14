import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DevicesModule } from './devices/devices.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [DevicesModule, TerminusModule],
  controllers: [HealthController],
})
export class AppModule {}

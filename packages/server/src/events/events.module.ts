import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { DevicesModule } from '../devices/devices.module';

@Module({ imports: [DevicesModule], controllers: [EventsController] })
export class EventsModule {}

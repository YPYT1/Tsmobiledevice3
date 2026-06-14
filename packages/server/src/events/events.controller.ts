import { Controller, Get, Sse, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, fromEvent, map } from 'rxjs';
import { DevicesService } from '../devices/devices.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @Sse()
  @ApiOperation({ summary: 'SSE stream for device connect/disconnect events' })
  stream(): Observable<MessageEvent> {
    return fromEvent<any>(this.devicesService.pool, 'device:connected').pipe(
      map(device => ({ data: JSON.stringify({ type: 'connected', udid: device.serial, connectionType: device.connectionType }) }))
    );
  }
}

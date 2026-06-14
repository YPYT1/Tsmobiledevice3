import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DevicesService } from '../devices/devices.service';

const PROCESS_ATTRS = ['pid', 'cpuUsage', 'physFootprint'];
const SYSTEM_ATTRS = ['cpuTotalLoad', 'physMemory', 'memUsed'];

@WebSocketGateway({ cors: true })
export class PerfGateway implements OnGatewayDisconnect {
  private abortControllers = new Map<string, AbortController>();

  constructor(private readonly devicesService: DevicesService) {}

  @SubscribeMessage('subscribe:perf')
  async subscribe(
    @MessageBody() udid: string,
    @ConnectedSocket() client: Socket,
  ) {
    const key = `${client.id}:${udid}`;
    if (this.abortControllers.has(key)) return;

    const ac = new AbortController();
    this.abortControllers.set(key, ac);

    this.devicesService
      .withFactory(udid, async (factory) => {
        const dvt = await factory.dvt();
        const svc = await dvt.sysmontap();
        try {
          await svc.start(PROCESS_ATTRS, SYSTEM_ATTRS);
          for await (const sample of svc.samples()) {
            if (ac.signal.aborted) break;
            client.emit('perf:sample', sample);
          }
        } finally {
          await svc.stop().catch(() => {});
          await svc.close();
        }
      })
      .catch(() => {})
      .finally(() => this.abortControllers.delete(key));
  }

  @SubscribeMessage('unsubscribe:perf')
  unsubscribe(
    @MessageBody() udid: string,
    @ConnectedSocket() client: Socket,
  ) {
    const key = `${client.id}:${udid}`;
    this.abortControllers.get(key)?.abort();
    this.abortControllers.delete(key);
  }

  handleDisconnect(client: Socket) {
    for (const [key, ac] of this.abortControllers) {
      if (key.startsWith(`${client.id}:`)) {
        ac.abort();
        this.abortControllers.delete(key);
      }
    }
  }
}

import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DevicesService } from '../devices/devices.service';

@WebSocketGateway({ cors: true })
export class LogsGateway implements OnGatewayDisconnect {
  private abortControllers = new Map<string, AbortController>();

  constructor(private readonly devicesService: DevicesService) {}

  @SubscribeMessage('subscribe:logs')
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
        const svc = await factory.syslog();
        try {
          for await (const line of svc.lines(ac.signal)) {
            client.emit('log:line', line);
          }
        } finally {
          await svc.close();
        }
      })
      .catch(() => {})
      .finally(() => this.abortControllers.delete(key));
  }

  @SubscribeMessage('unsubscribe:logs')
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

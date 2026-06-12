import net from 'net';
import plist from 'plist';
import { RemoteXPCConnection } from './RemoteXPCConnection';

export const RSD_PORT = 58783;

export interface RsdServiceInfo {
  Port: number;
  Properties?: { UsesRemoteXPC?: boolean };
}

export class RemoteServiceDiscovery {
  readonly xpc: RemoteXPCConnection;
  peerInfo: Record<string, any> | null = null;
  udid: string | null = null;
  productType: string | null = null;
  productVersion: string | null = null;

  constructor(public readonly host: string, port = RSD_PORT) {
    this.xpc = new RemoteXPCConnection(host, port);
  }

  async connect(): Promise<void> {
    await this.xpc.connect();
    this.peerInfo = this.xpc.peerInfo;
    const props = this.peerInfo?.Properties ?? {};
    this.udid = props.UniqueDeviceID ?? null;
    this.productType = props.ProductType ?? null;
    this.productVersion = props.OSVersion ?? null;
  }

  getServicePort(name: string): number {
    const svc = this.peerInfo?.Services?.[name];
    if (!svc) throw new Error(`RSD service not found: ${name}`);
    return Number(svc.Port);
  }

  /** Open a raw TCP socket to a service port (for plist-based services with RSDCheckin). */
  async startService(name: string): Promise<net.Socket> {
    const port = this.getServicePort(name);
    const socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection(port, this.host);
      const timer = setTimeout(() => { s.destroy(); reject(new Error('RSD service connect timeout')); }, 10000);
      s.once('connect', () => { clearTimeout(timer); resolve(s); });
      s.once('error', (e) => { clearTimeout(timer); reject(e); });
    });
    await this._rsdCheckin(socket);
    return socket;
  }

  /** Open a RemoteXPC connection to a service (for UsesRemoteXPC=true services). */
  startRemoteXpcService(name: string): RemoteXPCConnection {
    const port = this.getServicePort(name);
    return new RemoteXPCConnection(this.host, port);
  }

  private async _rsdCheckin(socket: net.Socket): Promise<void> {
    const checkin = { Label: 'ts-mobiledevice', ProtocolVersion: '2', Request: 'RSDCheckin' };
    const xml = plist.build(checkin);
    const payload = Buffer.from(xml, 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => socket.write(Buffer.concat([lenBuf, payload]), e => e ? rej(e) : res()));

    // Read two responses: RSDCheckin ack + StartService
    await this._recvPlist(socket);
    await this._recvPlist(socket);
  }

  private _recvPlist(socket: net.Socket): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let needed = -1;

      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        if (needed === -1 && buf.length >= 4) {
          needed = buf.readUInt32BE(0) + 4;
        }
        if (needed > 0 && buf.length >= needed) {
          socket.removeListener('data', onData);
          socket.removeListener('error', onErr);
          resolve(plist.parse(buf.subarray(4, needed).toString('utf8')) as Record<string, any>);
        }
      };
      const onErr = (e: Error) => { socket.removeListener('data', onData); reject(e); };
      socket.on('data', onData);
      socket.once('error', onErr);
    });
  }

  close(): void {
    this.xpc.close();
  }
}

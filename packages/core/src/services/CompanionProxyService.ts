import net from 'net';
import plist from 'plist';

export class CompanionProxyService {
  static readonly SERVICE_NAME = 'com.apple.companion_proxy';
  static readonly RSD_SERVICE_NAME = 'com.apple.companion_proxy.shim.remote';

  constructor(private socket: net.Socket) {}

  private async sendRecv(msg: Record<string, any>): Promise<Record<string, any>> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    return this._recv();
  }

  private async _send(msg: Record<string, any>): Promise<void> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
  }

  private async _recv(): Promise<Record<string, any>> {
    const lenBuf = await this._readExactly(4);
    const data = await this._readExactly(lenBuf.readUInt32BE(0));
    return plist.parse(data.toString('utf8')) as Record<string, any>;
  }

  private _readExactly(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error('timeout')), 10000);
      const tryRead = () => {
        while (received < size) { const c = sock.read(size - received) as Buffer | null; if (!c) break; chunks.push(c); received += c.length; }
        if (received >= size) { clearTimeout(timer); sock.removeListener('readable', tryRead); sock.removeListener('error', onErr); sock.removeListener('close', onClose); resolve(Buffer.concat(chunks).subarray(0, size)); }
      };
      const onErr = (e: Error) => cleanup(e);
      const onClose = () => cleanup(new Error('closed'));
      const cleanup = (e: Error) => { clearTimeout(timer); sock.removeListener('readable', tryRead); sock.removeListener('error', onErr); sock.removeListener('close', onClose); reject(e); };
      sock.on('readable', tryRead); sock.once('error', onErr); sock.once('close', onClose); tryRead();
    });
  }

  async list(): Promise<any[]> {
    const r = await this.sendRecv({ Command: 'GetDeviceRegistry' });
    return r.PairedDevicesArray ?? [];
  }

  async *listenForDevices(): AsyncGenerator<Record<string, any>> {
    await this._send({ Command: 'StartListeningForDevices' });
    while (true) yield await this._recv();
  }

  async getValue(udid: string, key: string): Promise<any> {
    const r = await this.sendRecv({ Command: 'GetValueFromRegistry', GetValueGizmoUDIDKey: udid, GetValueKeyKey: key });
    if (r.RetrievedValueDictionary != null) return r.RetrievedValueDictionary;
    throw new Error(r.Error ?? 'unknown error');
  }

  async startForwardingServicePort(remotePort: number, serviceName?: string): Promise<number> {
    const req: Record<string, any> = { Command: 'StartForwardingServicePort', GizmoRemotePortNumber: remotePort, IsServiceLowPriority: false, PreferWifi: false };
    if (serviceName) req.ForwardedServiceName = serviceName;
    const r = await this.sendRecv(req);
    return r.CompanionProxyServicePort;
  }

  async stopForwardingServicePort(remotePort: number): Promise<Record<string, any>> {
    return this.sendRecv({ Command: 'StopForwardingServicePort', GizmoRemotePortNumber: remotePort });
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

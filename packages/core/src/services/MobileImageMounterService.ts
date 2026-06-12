import net from 'net';
import plist from 'plist';

export class MobileImageMounterService {
  static readonly SERVICE_NAME = 'com.apple.mobile.mobile_image_mounter';
  static readonly RSD_SERVICE_NAME = 'com.apple.mobile.mobile_image_mounter.shim.remote';

  constructor(private socket: net.Socket) {}

  private async sendRecv(msg: Record<string, any>): Promise<Record<string, any>> {
    const payload = Buffer.from(plist.build(msg), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => this.socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    return this._recv();
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
      const timer = setTimeout(() => cleanup(new Error('timeout')), 30000);
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

  async lookupImage(imageType = 'Developer'): Promise<Record<string, any>> {
    return this.sendRecv({ Command: 'LookupImage', ImageType: imageType });
  }

  async uploadImage(imageType: string, imageData: Buffer, signature: Buffer): Promise<void> {
    const r = await this.sendRecv({ Command: 'ReceiveBytes', ImageType: imageType, ImageSize: imageData.length, ImageSignature: signature });
    if (r.Status !== 'ReceiveBytesAck') throw new Error(`upload failed: ${JSON.stringify(r)}`);
    await new Promise<void>((res, rej) => this.socket.write(imageData, e => e ? rej(e) : res()));
    const done = await this._recv();
    if (done.Status !== 'Complete') throw new Error(`upload not complete: ${JSON.stringify(done)}`);
  }

  async mountImage(imageType: string, signature: Buffer, trustCache?: Buffer, infoDict?: Buffer): Promise<Record<string, any>> {
    const msg: Record<string, any> = { Command: 'MountImage', ImageType: imageType, ImageSignature: signature };
    if (trustCache) msg.ImageTrustCache = trustCache;
    if (infoDict) msg.ImageInfoDict = infoDict;
    const r = await this.sendRecv(msg);
    if (r.Error) throw new Error(r.Error);
    return r;
  }

  async unmountImage(mountPath: string): Promise<void> {
    const r = await this.sendRecv({ Command: 'UnmountImage', MountPath: mountPath });
    if (r.Error) throw new Error(r.Error);
  }

  async queryDeveloperModeStatus(): Promise<boolean> {
    const r = await this.sendRecv({ Command: 'QueryDeveloperModeStatus' });
    return !!r.DeveloperModeStatus;
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

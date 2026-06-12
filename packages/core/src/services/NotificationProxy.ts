import net from 'net';
import plist from 'plist';

export class NotificationProxy {
  private socket: net.Socket;

  constructor(socket: net.Socket) {
    this.socket = socket;
  }

  private async _send(msg: object): Promise<void> {
    const xml = plist.build(msg as any);
    const payload = Buffer.from(xml, 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((resolve, reject) =>
      this.socket.write(Buffer.concat([len, payload]), (err) => err ? reject(err) : resolve())
    );
  }

  private _readExactly(size: number): Promise<Buffer> {
    const sock = this.socket;
    const chunks: Buffer[] = [];
    let received = 0;
    return new Promise((resolve, reject) => {
      const tryRead = () => {
        while (received < size) {
          const chunk = sock.read(size - received) as Buffer | null;
          if (!chunk) break;
          chunks.push(chunk);
          received += chunk.length;
        }
        if (received >= size) {
          sock.removeListener('readable', tryRead);
          sock.removeListener('error', onError);
          sock.removeListener('close', onClose);
          resolve(Buffer.concat(chunks).subarray(0, size));
        }
      };
      const onError = (e: Error) => { sock.removeListener('readable', tryRead); sock.removeListener('close', onClose); reject(e); };
      const onClose = () => { sock.removeListener('readable', tryRead); sock.removeListener('error', onError); reject(new Error('Socket closed')); };
      sock.on('readable', tryRead);
      sock.once('error', onError);
      sock.once('close', onClose);
      tryRead();
    });
  }

  private async _recv(): Promise<any> {
    const lenBuf = await this._readExactly(4);
    const size = lenBuf.readUInt32BE(0);
    const payload = await this._readExactly(size);
    return plist.parse(payload.toString('utf8'));
  }

  async postNotification(name: string): Promise<void> {
    await this._send({ Command: 'PostNotification', Name: name });
  }

  async observeNotification(name: string): Promise<void> {
    await this._send({ Command: 'ObserveNotification', Name: name });
  }

  async *notifications(): AsyncGenerator<string> {
    while (true) {
      const msg = await this._recv();
      if (msg && msg.Name) yield msg.Name as string;
    }
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

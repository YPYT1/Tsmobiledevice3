import net from 'net';
import plist from 'plist';

export class DebugServerAppListService {
  static readonly SERVICE_NAME = 'com.apple.debugserver.DVTSecureSocketProxy.applist';

  constructor(private socket: net.Socket) {}

  async get(): Promise<Record<string, any>> {
    let buf = Buffer.alloc(0);
    const CHUNK = 200;
    while (!buf.includes(Buffer.from('</plist>'))) {
      const chunk = await new Promise<Buffer | null>((resolve) => {
        const onData = (d: Buffer) => { cleanup(); resolve(d); };
        const onEnd = () => { cleanup(); resolve(null); };
        const cleanup = () => { this.socket.removeListener('data', onData); this.socket.removeListener('end', onEnd); };
        this.socket.once('data', onData);
        this.socket.once('end', onEnd);
      });
      if (!chunk) break;
      buf = Buffer.concat([buf, chunk]);
    }
    return plist.parse(buf.toString('utf8')) as Record<string, any>;
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

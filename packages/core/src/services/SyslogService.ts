import * as net from 'net';

const SYSLOG_LINE_SPLITTER = Buffer.from('\n\x00');

export class SyslogService {
  private closed = false;

  constructor(private socket: net.Socket) {}

  async *lines(): AsyncGenerator<string> {
    let buf = Buffer.alloc(0);

    const chunks: Buffer[] = [];
    let resolve: ((v: Buffer | null) => void) | null = null;

    const onData = (chunk: Buffer) => {
      if (resolve) {
        const r = resolve;
        resolve = null;
        r(chunk);
      } else {
        chunks.push(chunk);
      }
    };

    const onClose = () => {
      if (resolve) {
        const r = resolve;
        resolve = null;
        r(null);
      }
    };

    this.socket.on('data', onData);
    this.socket.on('close', onClose);
    this.socket.on('end', onClose);

    try {
      while (!this.closed) {
        let chunk: Buffer | null;
        if (chunks.length > 0) {
          chunk = chunks.shift()!;
        } else {
          chunk = await new Promise<Buffer | null>(r => { resolve = r; });
        }

        if (chunk === null || chunk.length === 0) break;

        buf = Buffer.concat([buf, chunk]);

        let idx: number;
        while ((idx = buf.indexOf(SYSLOG_LINE_SPLITTER)) !== -1) {
          const line = buf.slice(0, idx).toString('utf8');
          buf = buf.slice(idx + SYSLOG_LINE_SPLITTER.length);
          if (line.length > 0) yield line;
        }
      }
    } finally {
      this.socket.off('data', onData);
      this.socket.off('close', onClose);
      this.socket.off('end', onClose);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.socket.destroy();
  }
}

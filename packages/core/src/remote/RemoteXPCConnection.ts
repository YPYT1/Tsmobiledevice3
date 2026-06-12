import net from 'net';
import { EventEmitter } from 'events';
import {
  HTTP2_MAGIC, FrameType, buildSettings, buildSettingsAck,
  buildWindowUpdate, buildHeaders, buildData, parseFrame, H2Frame,
} from './h2';
import { XpcFlags, encodeXpcWrapper, decodeXpcWrapper } from './xpc';

const SETTINGS_MAX_CONCURRENT_STREAMS = 3;  // 0x3
const SETTINGS_INITIAL_WINDOW_SIZE = 4;     // 0x4
const WIN_SIZE = 16 * 1024 * 1024;
const WIN_INCR = WIN_SIZE - 65535;

const ROOT_CHANNEL = 1;
const REPLY_CHANNEL = 3;

export class RemoteXPCConnection extends EventEmitter {
  private socket: net.Socket | null = null;
  private readBuf = Buffer.alloc(0);
  private msgId: Record<number, bigint> = { [ROOT_CHANNEL]: 0n, [REPLY_CHANNEL]: 0n };
  private partialXpc: Record<number, Buffer> = {};
  private waiters: Array<(msg: Record<string, any>) => void> = [];
  private msgQueue: Array<Record<string, any>> = [];
  public peerInfo: Record<string, any> | null = null;

  constructor(private host: string, private port: number) {
    super();
  }

  async connect(): Promise<void> {
    this.socket = await new Promise<net.Socket>((resolve, reject) => {
      const s = net.createConnection(this.port, this.host);
      s.once('connect', () => resolve(s));
      s.once('error', reject);
      setTimeout(() => reject(new Error('RSD connect timeout')), 10000);
    });
    this.socket.on('data', (chunk: Buffer) => this._onData(chunk));
    this.socket.on('error', () => this.socket?.destroy());
    await this._handshake();
    this.peerInfo = await this.receiveResponse();
  }

  private _onData(chunk: Buffer): void {
    this.readBuf = Buffer.concat([this.readBuf, chunk]);
    while (true) {
      const result = parseFrame(this.readBuf);
      if (!result) break;
      const [frame, consumed] = result;
      this.readBuf = this.readBuf.subarray(consumed);
      this._handleFrame(frame);
    }
  }

  private _handleFrame(frame: H2Frame): void {
    if (frame.type === FrameType.SETTINGS && !(frame.flags & 0x1)) {
      this._write(buildSettingsAck());
    }
    if (frame.type !== FrameType.DATA || frame.payload.length === 0) return;

    const prev = this.partialXpc[frame.streamId] ?? Buffer.alloc(0);
    const buf = Buffer.concat([prev, frame.payload]);
    try {
      const msg = decodeXpcWrapper(buf);
      delete this.partialXpc[frame.streamId];
      if (!msg || msg.payload === null) return;
      if (typeof msg.payload !== 'object' || !msg.payload) return;
      this.msgId[frame.streamId] = msg.messageId + 1n;
      if (this.waiters.length > 0) {
        this.waiters.shift()!(msg.payload);
      } else {
        this.msgQueue.push(msg.payload);
      }
    } catch {
      this.partialXpc[frame.streamId] = buf;
    }
  }

  private _write(buf: Buffer): void {
    this.socket?.write(buf);
  }

  private async _handshake(): Promise<void> {
    this._write(HTTP2_MAGIC);
    this._write(buildSettings({
      [SETTINGS_MAX_CONCURRENT_STREAMS]: 100,
      [SETTINGS_INITIAL_WINDOW_SIZE]: WIN_SIZE,
    }));
    this._write(buildWindowUpdate(0, WIN_INCR));
    this._write(buildHeaders(ROOT_CHANNEL));

    // Send empty init wrapper
    const initWrap = encodeXpcWrapper({}, XpcFlags.ALWAYS_SET, this.msgId[ROOT_CHANNEL]++);
    this._write(buildData(ROOT_CHANNEL, initWrap));

    const sizeWrap = Buffer.alloc(16);
    sizeWrap.writeUInt32LE(0x29B00B92, 0);
    sizeWrap.writeUInt32LE(0x0201, 4);
    sizeWrap.writeBigUInt64LE(8n, 8);
    this._write(buildData(ROOT_CHANNEL, sizeWrap));

    // Open reply channel
    this._write(buildHeaders(REPLY_CHANNEL));
    const initHandshake = encodeXpcWrapper(null, XpcFlags.INIT_HANDSHAKE | XpcFlags.ALWAYS_SET, this.msgId[REPLY_CHANNEL]++);
    this._write(buildData(REPLY_CHANNEL, initHandshake));
  }

  async receiveResponse(): Promise<Record<string, any>> {
    if (this.msgQueue.length > 0) return this.msgQueue.shift()!;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w !== waiter);
        reject(new Error('RSD receive timeout'));
      }, 15000);
      const waiter = (msg: Record<string, any>) => { clearTimeout(timer); resolve(msg); };
      this.waiters.push(waiter);
    });
  }

  async sendRequest(payload: Record<string, any>, wantingReply = false): Promise<void> {
    let flags = XpcFlags.ALWAYS_SET;
    if (wantingReply) flags |= XpcFlags.WANTING_REPLY;
    const wrap = encodeXpcWrapper(payload, flags, this.msgId[ROOT_CHANNEL]++);
    this._write(buildData(ROOT_CHANNEL, wrap));
  }

  async sendReceiveRequest(payload: Record<string, any>): Promise<Record<string, any>> {
    await this.sendRequest(payload, true);
    return this.receiveResponse();
  }

  close(): void {
    this.socket?.destroy();
    this.socket?.unref();
    this.socket = null;
  }
}

import net from 'net';
import { EventEmitter } from 'events';
import { parseFragmentHeader, buildFragmentHeader, buildPayloadHeader, fragmentPayload } from './fragment';
import { FRAGMENT_HEADER_SIZE, PAYLOAD_HEADER_SIZE, DTXMessageType, DTXTransportFlags, DTXMessage } from './types';
import { encodeAux, decodeAux } from './dtx-aux';
import { unarchive, archiveValue } from './nska';

interface PendingReply {
  resolve: (msg: DTXMessage) => void;
  reject: (e: Error) => void;
}

interface ChannelHandler {
  onMessage: (msg: DTXMessage, decoded: { selector?: string; args: any[] }) => void;
  onClosed: () => void;
}

interface FragmentState {
  hdr: ReturnType<typeof parseFragmentHeader>;
  parts: Buffer[];
  received: number;
}

export class DtxConnection extends EventEmitter {
  private msgId = 1;
  private fragments = new Map<number, FragmentState>();
  private pending = new Map<number, PendingReply>();
  private channels = new Map<number, ChannelHandler>();
  private readChunks: Buffer[] = [];
  private readBufLen = 0;
  private nextChannelCode = 1;

  constructor(private socket: net.Socket) {
    super();
    socket.on('data', (chunk: Buffer) => this._onData(chunk));
    socket.on('close', () => this._onClose());
    socket.on('error', (e) => this._onClose(e));
  }

  private _onData(chunk: Buffer): void {
    this.readChunks.push(chunk);
    this.readBufLen += chunk.length;
    while (this.readBufLen >= FRAGMENT_HEADER_SIZE) {
      if (this.readChunks.length > 1) {
        const flat = Buffer.concat(this.readChunks);
        this.readChunks = [flat];
      }
      const readBuf = this.readChunks[0];
      let hdr: ReturnType<typeof parseFragmentHeader>;
      try {
        hdr = parseFragmentHeader(readBuf);
      } catch {
        this.readChunks = [];
        this.readBufLen = 0;
        break;
      }
      const wireBodySize = (hdr.index === 0 && hdr.count > 1) ? 0 : hdr.dataSize;
      const total = hdr.headerSize + wireBodySize;
      if (this.readBufLen < total) break;
      const body = readBuf.subarray(hdr.headerSize, total);
      const rest = readBuf.subarray(total);
      this.readChunks = rest.length > 0 ? [rest] : [];
      this.readBufLen -= total;
      this._onFragment(hdr, body);
    }
  }

  private _onFragment(hdr: ReturnType<typeof parseFragmentHeader>, body: Buffer): void {
    const id = hdr.identifier;
    if (hdr.count === 1) {
      this._dispatchMessage(hdr, body);
      return;
    }
    // index=0, count>1: header-only fragment declaring total size; body bytes are in fragments 1..N
    if (hdr.index === 0) {
      this.fragments.set(id, { hdr, parts: new Array(hdr.count - 1), received: 0 });
      return;
    }
    const state = this.fragments.get(id);
    if (!state) return;
    state.parts[hdr.index - 1] = body;
    state.received++;
    if (state.received === hdr.count - 1) {
      this.fragments.delete(id);
      this._dispatchMessage(state.hdr, Buffer.concat(state.parts));
    }
  }

  private _dispatchMessage(hdr: ReturnType<typeof parseFragmentHeader>, body: Buffer): void {
    if (body.length < PAYLOAD_HEADER_SIZE) return;
    const msgType = body.readUInt8(0);
    const auxSize = body.readUInt32LE(4);
    const payloadFlags = body.readUInt32LE(12);
    const totalSize = body.readUInt32LE(8);
    const auxData = body.subarray(PAYLOAD_HEADER_SIZE, PAYLOAD_HEADER_SIZE + auxSize);
    const payloadData = body.subarray(PAYLOAD_HEADER_SIZE + auxSize);

    const msg: DTXMessage = {
      identifier: hdr.identifier,
      conversationIndex: hdr.conversationIndex,
      channelCode: hdr.channelCode,
      flags: hdr.flags,
      payloadHeader: { msgType, auxSize, totalSize, flags: payloadFlags },
      auxData,
      payloadData,
    };

    // Is this a reply?
    if (hdr.conversationIndex > 0) {
      const p = this.pending.get(hdr.identifier);
      if (p) { this.pending.delete(hdr.identifier); p.resolve(msg); return; }
    }

    // Dispatch to channel handler
    const handler = this.channels.get(Math.abs(hdr.channelCode));
    if (handler) {
      const decoded = this._decode(msg);
      handler.onMessage(msg, decoded);
      return;
    }

    // Channel 0 = control channel
    if (hdr.channelCode === 0) {
      this._handleControl(msg);
    }
  }

  private _decode(msg: DTXMessage): { selector?: string; args: any[] } {
    let selector: string | undefined;
    let args: any[] = [];
    if (msg.payloadData.length > 0) {
      try {
        const decoded = unarchive(msg.payloadData);
        if (typeof decoded === 'string') selector = decoded;
        else if (Array.isArray(decoded)) { [selector, ...args] = decoded; }
        else selector = String(decoded ?? '');
      } catch { /* ignore */ }
    }
    if (msg.auxData.length > 0) {
      const rawArgs = decodeAux(msg.auxData);
      // bplist-encoded buffers are NSKeyedArchive-decoded
      args = rawArgs.map(a => {
        if (Buffer.isBuffer(a)) {
          try { return unarchive(a); } catch { return a; }
        }
        return a;
      });
    }
    return { selector, args };
  }

  private _handleControl(msg: DTXMessage): void {
    const { selector, args } = this._decode(msg);
    if (selector === '_notifyOfPublishedCapabilities:') {
      this.emit('capabilities', args[0]);
    }
  }

  private _onClose(err?: Error): void {
    const e = err ?? new Error('DTX connection closed');
    for (const p of this.pending.values()) p.reject(e);
    this.pending.clear();
    for (const ch of this.channels.values()) ch.onClosed();
    this.emit('close', e);
  }

  async send(
    channelCode: number,
    payloadData: Buffer,
    auxArgs: any[] = [],
    msgType: number = DTXMessageType.DISPATCH,
    expectsReply = false,
    conversationIndex = 0,
  ): Promise<DTXMessage | null> {
    const id = this.msgId++;
    const auxData = auxArgs.length > 0 ? encodeAux(auxArgs) : Buffer.alloc(0);
    const totalSize = auxData.length + payloadData.length;
    const flags = expectsReply ? DTXTransportFlags.EXPECTS_REPLY : DTXTransportFlags.NONE;

    const payloadHdr = buildPayloadHeader(msgType, auxData.length, totalSize, 0);
    const fullPayload = Buffer.concat([payloadHdr, auxData, payloadData]);

    const frags = fragmentPayload(fullPayload, id, conversationIndex, channelCode, flags);
    for (const frag of frags) {
      await new Promise<void>((res, rej) => this.socket.write(frag, e => e ? rej(e) : res()));
    }

    if (!expectsReply) return null;
    return new Promise<DTXMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DTX timeout waiting for reply to msg ${id}`));
      }, 15000);
      this.pending.set(id, {
        resolve: (m) => { clearTimeout(timer); resolve(m); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
    });
  }

  registerChannel(code: number, handler: ChannelHandler): void {
    this.channels.set(code, handler);
  }

  unregisterChannel(code: number): void {
    this.channels.delete(code);
  }

  async openChannel(identifier: string): Promise<number> {
    const code = this.nextChannelCode++;
    const payload = archiveValue('_requestChannelWithCode:identifier:');
    const reply = await this.send(0, payload, [code, archiveValue(identifier)], DTXMessageType.DISPATCH, true);
    if (!reply) throw new Error('No reply from openChannel');
    return code;
  }

  async publishCapabilities(caps: Record<string, number>): Promise<void> {
    const payload = archiveValue('_notifyOfPublishedCapabilities:');
    await this.send(0, payload, [archiveValue(caps)], DTXMessageType.DISPATCH, false);
  }

  close(): void {
    this.socket.destroy();
    this.socket.unref();
  }
}

import net from 'net';
import { DtxConnection } from './connection';
import { unarchive, archiveValue } from './nska';
import { DTXMessageType, DTXMessage } from './types';

/**
 * High-level channel wrapper. Sends selector+args, optionally awaits reply.
 */
export class DtxChannel {
  private msgQueue: Array<{ selector?: string; args: any[] }> = [];
  private waiters: Array<(v: { selector?: string; args: any[] }) => void> = [];

  constructor(
    readonly conn: DtxConnection,
    readonly code: number,
  ) {
    conn.registerChannel(code, {
      onMessage: (_msg, decoded) => this._push(decoded),
      onClosed: () => this._pushClose(),
    });
  }

  private _push(decoded: { selector?: string; args: any[] }): void {
    if (this.waiters.length > 0) {
      this.waiters.shift()!(decoded);
    } else {
      this.msgQueue.push(decoded);
    }
  }

  private _pushClose(): void {
    for (const w of this.waiters) w({ selector: '__closed__', args: [] });
    this.waiters = [];
  }

  async recv(timeoutMs = 30000): Promise<{ selector?: string; args: any[] }> {
    if (this.msgQueue.length > 0) return this.msgQueue.shift()!;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(resolve);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(new Error(`DtxChannel.recv timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      this.waiters.push((v) => { clearTimeout(timer); resolve(v); });
    });
  }

  async invoke(selector: string, args: any[] = [], expectsReply = true): Promise<any> {
    const payload = archiveValue(selector);
    // Non-primitive args are NSKeyedArchive-encoded as Buffer
    const auxArgs = args.map(a =>
      (a === null || typeof a === 'number' || typeof a === 'bigint' || Buffer.isBuffer(a))
        ? a : archiveValue(a)
    );
    const reply = await this.conn.send(this.code, payload, auxArgs, DTXMessageType.DISPATCH, expectsReply);
    if (!expectsReply || !reply) return null;
    if (reply.payloadData.length === 0) return null;
    try { return unarchive(reply.payloadData); } catch { return null; }
  }

  close(): void {
    this.conn.unregisterChannel(this.code);
  }
}

/**
 * DvtServiceProvider: establishes DTX connection to com.apple.instruments.remoteserver.DVTSecureSocketProxy
 * then opens per-instrument channels on demand.
 */
export class DvtServiceProvider {
  static readonly SERVICE_NAME = 'com.apple.instruments.remoteserver.DVTSecureSocketProxy';
  static readonly RSD_SERVICE_NAME = 'com.apple.instruments.dtservicehub';

  readonly conn: DtxConnection;
  private _ready = false;

  constructor(socket: net.Socket) {
    this.conn = new DtxConnection(socket);
  }

  async connect(): Promise<void> {
    if (this._ready) return;
    const capabilitiesPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DVT connect timeout')), 10000);
      const onCaps = () => {
        clearTimeout(timer);
        this.conn.removeListener('close', onClose);
        resolve();
      };
      const onClose = (e: Error) => { clearTimeout(timer); this.conn.removeListener('capabilities', onCaps); reject(e); };
      this.conn.once('capabilities', onCaps);
      this.conn.once('close', onClose);
    });
    // Send our capabilities first (device may send theirs back)
    await this.conn.publishCapabilities({
      'com.apple.private.DTXBlockCompression': 0,
      'com.apple.private.DTXConnection': 1,
      'com.apple.instruments.client.processcontrol.capability.terminationCallback': 1,
    });
    await capabilitiesPromise;
    this._ready = true;
  }

  async openChannel(identifier: string): Promise<DtxChannel> {
    await this.connect();
    const code = await this.conn.openChannel(identifier);
    return new DtxChannel(this.conn, code);
  }

  close(): void {
    this.conn.close();
  }
}

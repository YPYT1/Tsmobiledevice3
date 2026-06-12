import net from 'net';
import plist from 'plist';
import { randomUUID } from 'crypto';

export interface WirPage {
  id: number;
  type: string;
  url: string;
  title: string;
}

export class WebInspectorService {
  static readonly SERVICE_NAME = 'com.apple.webinspector';

  private connectionId = randomUUID().toUpperCase();
  private connectedApps: Record<string, any> = {};
  private appPages: Record<string, Record<string, WirPage>> = {};

  constructor(private socket: net.Socket) {}

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

  private async _sendMsg(selector: string, args: Record<string, any> = {}): Promise<void> {
    await this._send({
      __selector: selector,
      __argument: { ...args, WIRConnectionIdentifierKey: this.connectionId },
    });
  }

  private _handleMsg(msg: Record<string, any>): void {
    const sel: string = msg['__selector'];
    const arg: Record<string, any> = msg['__argument'] ?? {};
    if (sel === '_rpc_reportConnectedApplicationList:') {
      this.connectedApps = {};
      for (const [key, app] of Object.entries(arg['WIRApplicationDictionaryKey'] ?? {})) {
        this.connectedApps[key] = app;
      }
    } else if (sel === '_rpc_applicationConnected:') {
      const appId = arg['WIRApplicationIdentifierKey'];
      if (appId) this.connectedApps[appId] = arg;
    } else if (sel === '_rpc_applicationDisconnected:') {
      const appId = arg['WIRApplicationIdentifierKey'];
      if (appId) { delete this.connectedApps[appId]; delete this.appPages[appId]; }
    } else if (sel === '_rpc_applicationSentListing:') {
      const appId: string = arg['WIRApplicationIdentifierKey'];
      const listing: Record<string, any> = arg['WIRListingKey'] ?? {};
      const pages: Record<string, WirPage> = {};
      for (const [id_, page] of Object.entries(listing)) {
        const type: string = page['WIRTypeKey'] ?? '';
        if (type === 'WIRTypeWeb' || type === 'WIRTypeWebPage') {
          pages[id_] = { id: page['WIRPageIdentifierKey'], type, url: page['WIRURLKey'] ?? '', title: page['WIRTitleKey'] ?? '' };
        }
      }
      this.appPages[appId] = pages;
    }
  }

  /** Connect, identify, drain initial messages, request listings, and return open web pages. */
  async getOpenPages(): Promise<WirPage[]> {
    // Identify ourselves
    await this._sendMsg('_rpc_reportIdentifier:');

    // Drain messages for a short window to collect connected apps
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      let timer: ReturnType<typeof setTimeout>;
      const msg = await Promise.race([
        this._recv(),
        new Promise<null>(r => { timer = setTimeout(() => r(null), deadline - Date.now()); }),
      ]);
      clearTimeout(timer!);
      if (!msg) break;
      this._handleMsg(msg);
      // Once we have the application list, request listings immediately
      if (msg['__selector'] === '_rpc_reportConnectedApplicationList:') break;
    }

    // Request page listing for each connected app
    for (const appId of Object.keys(this.connectedApps)) {
      await this._sendMsg('_rpc_forwardGetListing:', { WIRApplicationIdentifierKey: appId });
    }

    // Drain listing responses
    const listDeadline = Date.now() + 3000;
    while (Date.now() < listDeadline) {
      let timer: ReturnType<typeof setTimeout>;
      const msg = await Promise.race([
        this._recv(),
        new Promise<null>(r => { timer = setTimeout(() => r(null), listDeadline - Date.now()); }),
      ]);
      clearTimeout(timer!);
      if (!msg) break;
      this._handleMsg(msg);
    }

    const pages: WirPage[] = [];
    for (const appPages of Object.values(this.appPages)) {
      pages.push(...Object.values(appPages));
    }
    return pages;
  }

  async sendMessage(msg: Record<string, any>): Promise<void> {
    await this._send(msg);
  }

  async *messages(): AsyncGenerator<Record<string, any>> {
    while (true) yield await this._recv();
  }

  async reportIdentifier(connectionId: string, senderId: string): Promise<void> {
    await this._send({
      __selector: '_rpc_reportIdentifier:',
      __argument: { WIRConnectionIdentifierKey: connectionId, WIRSenderKey: senderId },
    });
  }

  async getConnectedApplications(connectionId: string): Promise<Record<string, any>> {
    await this._send({
      __selector: '_rpc_getConnectedApplications:',
      __argument: { WIRConnectionIdentifierKey: connectionId },
    });
    return this._recv();
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

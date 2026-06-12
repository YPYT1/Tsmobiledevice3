import net from 'net';
import tls from 'tls';
import plist from 'plist';
import { MuxException, NotPairedError, InvalidHostIDError } from '../exceptions';
import { readExactly } from '../utils/socket';

const LOCKDOWN_PORT = 62078;
const DEFAULT_LABEL = 'ts-mobiledevice';

// Port 62078 stored big-endian in protocol
const LOCKDOWN_PORT_LE = Buffer.allocUnsafe(2);
LOCKDOWN_PORT_LE.writeUInt16BE(LOCKDOWN_PORT, 0);
export const LOCKDOWN_PORT_USBMUX = LOCKDOWN_PORT_LE.readUInt16LE(0);

export interface LockdownValue {
  [key: string]: any;
}

export class LockdownClient {
  private socket: net.Socket | tls.TLSSocket;
  private sessionId: string | null = null;
  public pairRecord: LockdownValue | null = null;
  public allValues: LockdownValue = {};
  public udid: string | null = null;
  public productVersion: string = '1.0';
  public productType: string | null = null;

  constructor(socket: net.Socket) {
    this.socket = socket;
  }

  static async create(muxSocket: net.Socket, pairRecord?: LockdownValue): Promise<LockdownClient> {
    const client = new LockdownClient(muxSocket);
    client.pairRecord = pairRecord || null;
    await client._initialize();
    return client;
  }

  private async _sendRecv(msg: LockdownValue): Promise<LockdownValue> {
    const xml = plist.build(msg);
    const payload = Buffer.from(xml, 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(payload.length, 0); // big-endian for lockdown
    await this._write(Buffer.concat([lenBuf, payload]));
    return this._recv();
  }

  private _write(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(data, (err) => err ? reject(err) : resolve());
    });
  }

  private async _recv(): Promise<LockdownValue> {
    const lenBuf = await this._readExactly(4);
    const size = lenBuf.readUInt32BE(0);
    const payload = await this._readExactly(size);
    return plist.parse(payload.toString('utf8')) as LockdownValue;
  }

  private _readExactly(size: number): Promise<Buffer> {
    return readExactly(this.socket, size);
  }

  private _verifyResponse(request: string, response: LockdownValue): LockdownValue {
    if (response.Request !== request) {
      throw new MuxException(`Unexpected response for ${request}: ${JSON.stringify(response)}`);
    }
    const error = response.Error;
    if (error) {
      const map: Record<string, new (msg: string) => Error> = {
        NotPaired: NotPairedError,
        InvalidHostID: InvalidHostIDError,
        SessionInactive: MuxException,
      };
      const Cls = map[error] || MuxException;
      throw new Cls(error);
    }
    return response;
  }

  async queryType(): Promise<string> {
    const r = await this._sendRecv({ Label: DEFAULT_LABEL, Request: 'QueryType' });
    return r.Type as string;
  }

  async getValue(key?: string, domain?: string): Promise<any> {
    const msg: LockdownValue = { Label: DEFAULT_LABEL, Request: 'GetValue' };
    if (domain) msg.Domain = domain;
    if (key) msg.Key = key;
    const r = this._verifyResponse('GetValue', await this._sendRecv(msg));
    return r.Value;
  }

  async startSession(hostId: string, systemBuid: string): Promise<{ sessionId: string; enableSSL: boolean }> {
    const r = await this._sendRecv({
      Label: DEFAULT_LABEL,
      Request: 'StartSession',
      HostID: hostId,
      SystemBUID: systemBuid,
    });
    if (r.Error) throw new MuxException(`StartSession error: ${r.Error}`);
    return { sessionId: r.SessionID as string, enableSSL: !!r.EnableSessionSSL };
  }

  async stopSession(): Promise<void> {
    if (!this.sessionId) return;
    await this._sendRecv({ Label: DEFAULT_LABEL, Request: 'StopSession', SessionID: this.sessionId });
    this.sessionId = null;
  }

  async upgradeToSSL(certPem: Buffer, keyPem: Buffer): Promise<void> {
    const rawSocket = this.socket as net.Socket;
    const tlsSocket = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const s = tls.connect({
        socket: rawSocket,
        rejectUnauthorized: false,
        cert: certPem,
        key: keyPem,
        minVersion: 'TLSv1.2',
      });
      const timer = setTimeout(() => reject(new Error('TLS handshake timeout')), 10000);
      s.once('secureConnect', () => { clearTimeout(timer); resolve(s); });
      s.once('error', (e) => { clearTimeout(timer); reject(e); });
    });
    this.socket = tlsSocket;
  }

  async validatePairing(pairRecord: LockdownValue): Promise<boolean> {
    try {
      const { sessionId, enableSSL } = await this.startSession(pairRecord.HostID, pairRecord.SystemBUID ?? '');
      this.sessionId = sessionId;
      if (enableSSL) {
        await this.upgradeToSSL(pairRecord.HostCertificate, pairRecord.HostPrivateKey);
      }
      this.pairRecord = pairRecord;
      return true;
    } catch (e) {
      if (e instanceof MuxException || (e instanceof Error && e.message.includes('session'))) return false;
      throw e;
    }
  }

  private async _initialize(): Promise<void> {
    const type = await this.queryType();
    if (type !== 'com.apple.mobile.lockdown') {
      throw new MuxException(`Unexpected lockdown type: ${type}`);
    }
    const values = await this.getValue();
    this.allValues = values || {};
    this.udid = this.allValues.UniqueDeviceID || null;
    this.productVersion = this.allValues.ProductVersion || '1.0';
    this.productType = this.allValues.ProductType || null;
  }

  async startService(name: string): Promise<{ port: number; enableSSL: boolean }> {
    if (!this.sessionId) throw new MuxException('Must start session before starting services');
    const r = this._verifyResponse('StartService',
      await this._sendRecv({ Label: DEFAULT_LABEL, Request: 'StartService', Service: name }));
    return { port: r.Port as number, enableSSL: !!r.EnableServiceSSL };
  }

  async close(): Promise<void> {
    try { await this.stopSession(); } catch { /* ignore */ }
    this.socket.destroy();
    this.socket.unref();
  }
}

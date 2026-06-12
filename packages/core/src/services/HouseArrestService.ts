import net from 'net';
import plist from 'plist';
import { AfcService } from './AfcService';
import { readExactly } from '../utils/socket';

export class HouseArrestService extends AfcService {
  static readonly SERVICE_NAME = 'com.apple.mobile.house_arrest';
  static readonly RSD_SERVICE_NAME = 'com.apple.mobile.house_arrest.shim.remote';

  static async open(socket: net.Socket, bundleId: string, documentsOnly = false): Promise<HouseArrestService> {
    // Handshake before AfcService registers its listeners
    const cmd = documentsOnly ? 'VendDocuments' : 'VendContainer';
    const payload = Buffer.from(plist.build({ Command: cmd, Identifier: bundleId }), 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    await new Promise<void>((res, rej) => socket.write(Buffer.concat([len, payload]), e => e ? rej(e) : res()));
    const lenBuf = await readExactly(socket, 4);
    const data = await readExactly(socket, lenBuf.readUInt32BE(0));
    const resp = plist.parse(data.toString('utf8')) as Record<string, any>;
    if (resp.Error) throw new Error(resp.Error === 'ApplicationLookupFailed' ? `App not found: ${bundleId}` : resp.Error);
    // Now safe to hand socket to AfcService
    return new HouseArrestService(socket);
  }
}

import { EventEmitter } from 'events';
import net from 'net';
import { AfcService } from '../AfcService';

function makeMockSocket(writeErr?: Error): net.Socket {
  const sock = new EventEmitter() as any;
  sock.read = jest.fn().mockReturnValue(null);
  sock.write = jest.fn((_data: Buffer, cb?: (err?: Error) => void) => {
    if (cb) cb(writeErr);
  });
  sock.destroy = jest.fn();
  return sock as net.Socket;
}

describe('AfcService write error handling', () => {
  // BUG-04: socket write failure must reject the pending promise
  it('rejects pending request when socket write fails', async () => {
    const writeError = new Error('write EPIPE');
    const sock = makeMockSocket(writeError);
    const svc = new AfcService(sock);
    await expect(svc.listdir('/')).rejects.toThrow('write EPIPE');
  });

  it('resolves request when write succeeds and response arrives', async () => {
    const sock = makeMockSocket(undefined);
    const svc = new AfcService(sock);

    // queue a promise, then emit a valid STATUS=0 response (packet num 0)
    const req = svc.listdir('/');

    // Build a minimal valid AFC response: STATUS opcode, packetNum=0, no error
    const HEADER_SIZE = 40;
    const AFCMAGIC = Buffer.from('CFA6LPAA');
    const payload = Buffer.alloc(8); // status code = 0
    payload.writeBigUInt64LE(0n, 0);
    const entireLen = BigInt(HEADER_SIZE + payload.length);
    const hdr = Buffer.alloc(HEADER_SIZE);
    AFCMAGIC.copy(hdr, 0);
    hdr.writeBigUInt64LE(entireLen, 8);        // entireLength
    hdr.writeBigUInt64LE(entireLen, 16);       // thisLength
    hdr.writeBigUInt64LE(0n, 24);              // packetNum = 0
    hdr.writeBigUInt64LE(1n, 32);              // operation = STATUS
    const response = Buffer.concat([hdr, payload]);

    sock.emit('readable');
    // inject data into the readable buffer
    (sock as any).read = jest.fn().mockReturnValueOnce(response).mockReturnValue(null);
    sock.emit('readable');

    // STATUS with code 0 resolves
    await expect(req).resolves.toBeDefined();
  });
});

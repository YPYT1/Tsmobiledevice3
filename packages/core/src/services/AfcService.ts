import net from 'net';

const AFCMAGIC = Buffer.from('CFA6LPAA');
const HEADER_SIZE = 40;
const MAXIMUM_READ_SIZE = 4 * 1024 * 1024;
const MAXIMUM_WRITE_SIZE = 1 << 30;

const AfcOpcode = {
  STATUS: 1,
  DATA: 2,
  READ_DIR: 3,
  REMOVE_PATH: 8,
  MAKE_DIR: 9,
  GET_FILE_INFO: 10,
  GET_DEVINFO: 11,
  FILE_OPEN: 13,
  READ: 15,
  WRITE: 16,
  FILE_CLOSE: 20,
  RENAME_PATH: 24,
} as const;

const AfcFileMode = {
  RDONLY: 1,
  WRONLY: 3,
  WR: 4,
} as const;

const AfcError: Record<number, string> = {
  0: 'SUCCESS',
  1: 'UNKNOWN_ERROR',
  2: 'OP_HEADER_INVALID',
  3: 'NO_RESOURCES',
  4: 'READ_ERROR',
  5: 'WRITE_ERROR',
  6: 'UNKNOWN_PACKET_TYPE',
  7: 'INVALID_ARG',
  8: 'OBJECT_NOT_FOUND',
  9: 'OBJECT_IS_DIR',
  10: 'PERM_DENIED',
  11: 'SERVICE_NOT_CONNECTED',
  12: 'OP_TIMEOUT',
  13: 'TOO_MUCH_DATA',
  14: 'END_OF_DATA',
  15: 'OP_NOT_SUPPORTED',
  16: 'OBJECT_EXISTS',
  17: 'OBJECT_BUSY',
  18: 'NO_SPACE_LEFT',
  19: 'OP_WOULD_BLOCK',
  20: 'IO_ERROR',
  21: 'OP_INTERRUPTED',
  22: 'OP_IN_PROGRESS',
  23: 'INTERNAL_ERROR',
};

function writeUInt64LE(buf: Buffer, value: bigint, offset: number): void {
  buf.writeBigUInt64LE(value, offset);
}

function buildHeader(entireLength: bigint, thisLength: bigint, packetNum: bigint, operation: bigint): Buffer {
  const hdr = Buffer.alloc(HEADER_SIZE);
  AFCMAGIC.copy(hdr, 0);
  writeUInt64LE(hdr, entireLength, 8);
  writeUInt64LE(hdr, thisLength, 16);
  writeUInt64LE(hdr, packetNum, 24);
  writeUInt64LE(hdr, operation, 32);
  return hdr;
}

function cstring(s: string): Buffer {
  return Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
}

export class AfcService {
  private packetNum = BigInt(0);
  private pending = new Map<bigint, { resolve: (d: Buffer) => void; reject: (e: Error) => void }>();
  private readChunks: Buffer[] = [];
  private readBufLen = 0;
  private readonly _boundReadable: () => void;
  private readonly _boundError: (e: Error) => void;
  private readonly _boundClose: () => void;

  constructor(protected socket: net.Socket) {
    this._boundReadable = () => this._onReadable();
    this._boundError = (e: Error) => this._rejectAll(e);
    this._boundClose = () => this._rejectAll(new Error('Socket closed'));
    socket.on('readable', this._boundReadable);
    socket.on('error', this._boundError);
    socket.on('close', this._boundClose);
  }

  static async create(muxSocket: net.Socket): Promise<AfcService> {
    return new AfcService(muxSocket);
  }

  private _rejectAll(e: Error): void {
    for (const p of this.pending.values()) p.reject(e);
    this.pending.clear();
  }

  private _onReadable(): void {
    while (true) {
      const chunk = this.socket.read() as Buffer | null;
      if (!chunk) break;
      this.readChunks.push(chunk);
      this.readBufLen += chunk.length;
    }
    this._tryDispatch();
  }

  private _tryDispatch(): void {
    while (this.readBufLen >= HEADER_SIZE) {
      if (this.readChunks.length > 1) {
        const flat = Buffer.concat(this.readChunks);
        this.readChunks = [flat];
      }
      const buf = this.readChunks[0];
      const entireLength = Number(buf.readBigUInt64LE(8));
      if (this.readBufLen < entireLength) break;

      const operation = Number(buf.readBigUInt64LE(32));
      const packetNum = buf.readBigUInt64LE(24);
      const payload = buf.subarray(HEADER_SIZE, entireLength);
      const rest = buf.subarray(entireLength);
      this.readChunks = rest.length > 0 ? [rest] : [];
      this.readBufLen -= entireLength;

      const pending = this.pending.get(packetNum);
      if (!pending) continue;
      this.pending.delete(packetNum);

      if (operation === AfcOpcode.STATUS) {
        const code = payload.length >= 8 ? Number(payload.readBigUInt64LE(0)) : 0;
        if (code !== 0) {
          pending.reject(new Error(`AFC error ${code}: ${AfcError[code] ?? 'UNKNOWN'}`));
        } else {
          pending.resolve(payload);
        }
      } else {
        pending.resolve(payload);
      }
    }
  }

  private _send(operation: number, payload: Buffer, thisLengthOverride?: bigint): bigint {
    const num = this.packetNum++;
    const entireLength = BigInt(HEADER_SIZE + payload.length);
    const thisLength = thisLengthOverride ?? entireLength;
    const hdr = buildHeader(entireLength, thisLength, num, BigInt(operation));
    this.socket.write(Buffer.concat([hdr, payload]));
    return num;
  }

  private _request(operation: number, payload: Buffer, thisLengthOverride?: bigint): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const num = this._send(operation, payload, thisLengthOverride);
      this.pending.set(num, { resolve, reject });
    });
  }

  async listdir(path: string): Promise<string[]> {
    const data = await this._request(AfcOpcode.READ_DIR, cstring(path));
    // parse null-terminated strings, skip '.' and '..'
    const parts: string[] = [];
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0) {
        const s = data.subarray(start, i).toString('utf8');
        if (s) parts.push(s);
        start = i + 1;
      }
    }
    return parts.filter(p => p !== '.' && p !== '..');
  }

  async stat(path: string): Promise<Record<string, string>> {
    const data = await this._request(AfcOpcode.GET_FILE_INFO, cstring(path));
    const result: Record<string, string> = {};
    const parts: string[] = [];
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0) {
        parts.push(data.subarray(start, i).toString('utf8'));
        start = i + 1;
      }
    }
    for (let i = 0; i + 1 < parts.length; i += 2) {
      result[parts[i]] = parts[i + 1];
    }
    return result;
  }

  async makedirs(path: string): Promise<void> {
    await this._request(AfcOpcode.MAKE_DIR, cstring(path));
  }

  async rm(path: string): Promise<void> {
    await this._request(AfcOpcode.REMOVE_PATH, cstring(path));
  }

  async rename(src: string, dst: string): Promise<void> {
    await this._request(AfcOpcode.RENAME_PATH, Buffer.concat([cstring(src), cstring(dst)]));
  }

  async getDeviceInfo(): Promise<Record<string, string>> {
    const data = await this._request(AfcOpcode.GET_DEVINFO, Buffer.alloc(0));
    const result: Record<string, string> = {};
    const parts: string[] = [];
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0) {
        parts.push(data.subarray(start, i).toString('utf8'));
        start = i + 1;
      }
    }
    for (let i = 0; i + 1 < parts.length; i += 2) {
      result[parts[i]] = parts[i + 1];
    }
    return result;
  }

  async fopen(path: string, mode: 'r' | 'w' | 'r+'): Promise<bigint> {
    const modeMap = { 'r': AfcFileMode.RDONLY, 'w': AfcFileMode.WRONLY, 'r+': AfcFileMode.WR };
    const modeVal = modeMap[mode];
    const payload = Buffer.alloc(8 + Buffer.byteLength(path) + 1);
    payload.writeBigUInt64LE(BigInt(modeVal), 0);
    Buffer.from(path, 'utf8').copy(payload, 8);
    payload[8 + Buffer.byteLength(path)] = 0;
    const data = await this._request(AfcOpcode.FILE_OPEN, payload);
    return data.readBigUInt64LE(0);
  }

  async fclose(handle: bigint): Promise<void> {
    const payload = Buffer.alloc(8);
    payload.writeBigUInt64LE(handle, 0);
    await this._request(AfcOpcode.FILE_CLOSE, payload);
  }

  async *freadStream(handle: bigint, size: number): AsyncGenerator<Buffer> {
    let remaining = size;
    while (remaining > 0) {
      const chunkSize = Math.min(remaining, MAXIMUM_READ_SIZE);
      const payload = Buffer.alloc(16);
      payload.writeBigUInt64LE(handle, 0);
      payload.writeBigUInt64LE(BigInt(chunkSize), 8);
      const data = await this._request(AfcOpcode.READ, payload);
      if (data.length === 0) break;
      yield data;
      remaining -= data.length;
    }
  }

  async fread(handle: bigint, size: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let remaining = size;
    while (remaining > 0) {
      const chunkSize = Math.min(remaining, MAXIMUM_READ_SIZE);
      const payload = Buffer.alloc(16);
      payload.writeBigUInt64LE(handle, 0);
      payload.writeBigUInt64LE(BigInt(chunkSize), 8);
      const data = await this._request(AfcOpcode.READ, payload);
      if (data.length === 0) break;
      chunks.push(data);
      remaining -= data.length;
    }
    return Buffer.concat(chunks);
  }

  async fwrite(handle: bigint, data: Buffer): Promise<void> {
    let offset = 0;
    while (offset < data.length) {
      const chunk = data.subarray(offset, offset + MAXIMUM_WRITE_SIZE);
      const handleBuf = Buffer.alloc(8);
      handleBuf.writeBigUInt64LE(handle, 0);
      const payload = Buffer.concat([handleBuf, chunk]);
      // this_length = 40 + 8 (header + handle only), entire_length = 40 + 8 + chunk.length
      await this._request(AfcOpcode.WRITE, payload, BigInt(48));
      offset += chunk.length;
    }
  }

  async getFileContents(path: string): Promise<Buffer> {
    // resolve symlink
    let realPath = path;
    const info = await this.stat(path);
    if (info['st_ifmt'] === 'S_IFLNK') {
      realPath = info['LinkTarget'] ?? path;
    }
    const statInfo = await this.stat(realPath);
    if (statInfo['st_ifmt'] !== 'S_IFREG') {
      throw new Error(`Not a regular file: ${realPath}`);
    }
    const size = parseInt(statInfo['st_size'] ?? '0', 10);
    const handle = await this.fopen(realPath, 'r');
    try {
      return await this.fread(handle, size);
    } finally {
      await this.fclose(handle);
    }
  }

  async setFileContents(path: string, data: Buffer): Promise<void> {
    const handle = await this.fopen(path, 'w');
    try {
      await this.fwrite(handle, data);
    } finally {
      await this.fclose(handle);
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async *walk(dir: string): AsyncGenerator<{ path: string; isDir: boolean }> {
    const entries = await this.listdir(dir);
    for (const entry of entries) {
      const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
      const info = await this.stat(fullPath);
      const isDir = info['st_ifmt'] === 'S_IFDIR';
      yield { path: fullPath, isDir };
      if (isDir) {
        yield* this.walk(fullPath);
      }
    }
  }

  async close(): Promise<void> {
    this._rejectAll(new Error('Service closed'));
    this.socket.removeListener('readable', this._boundReadable);
    this.socket.removeListener('error', this._boundError);
    this.socket.removeListener('close', this._boundClose);
    this.socket.destroy();
  }
}

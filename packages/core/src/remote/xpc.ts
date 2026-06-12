// XPC binary codec — wire format used by remoted on iOS 17+

const XPC_WRAPPER_MAGIC = 0x29B00B92;
const XPC_PAYLOAD_MAGIC = 0x42133742;
const XPC_PAYLOAD_VERSION = 0x00000005;

export const XpcFlags = {
  ALWAYS_SET:          0x00000001,
  DATA_PRESENT:        0x00000100,
  WANTING_REPLY:       0x00010000,
  REPLY:               0x00020000,
  FILE_TX_STREAM_REQ:  0x00100000,
  FILE_TX_STREAM_RES:  0x00200000,
  INIT_HANDSHAKE:      0x00400000,
};

const TYPE = {
  NULL:       0x00001000,
  BOOL:       0x00002000,
  INT64:      0x00003000,
  UINT64:     0x00004000,
  DOUBLE:     0x00005000,
  DATA:       0x00008000,
  STRING:     0x00009000,
  UUID:       0x0000A000,
  ARRAY:      0x0000E000,
  DICTIONARY: 0x0000F000,
  DATE:       0x00007000,
  FILE_TRANSFER: 0x0001A000,
};

// ─── decode ───────────────────────────────────────────────────────────────────

function align4(n: number): number { return (n + 3) & ~3; }

function readCString(buf: Buffer, off: number): [string, number] {
  let end = off;
  while (end < buf.length && buf[end] !== 0) end++;
  const s = buf.subarray(off, end).toString('utf8');
  return [s, align4(end + 1)];
}

function decodeObj(buf: Buffer, off: number): [any, number] {
  const type = buf.readUInt32LE(off); off += 4;
  switch (type) {
    case TYPE.NULL:   return [null, off];
    case TYPE.BOOL:   { const v = buf.readUInt32LE(off); return [v !== 0, off + 4]; }
    case TYPE.INT64:  { const v = buf.readBigInt64LE(off); return [Number(v), off + 8]; }
    case TYPE.UINT64: { const v = buf.readBigUInt64LE(off); return [Number(v), off + 8]; }
    case TYPE.DOUBLE: { const v = buf.readDoubleBE(off); return [v, off + 8]; }
    case TYPE.DATE:   { const ns = buf.readBigUInt64LE(off); return [new Date(Number(ns) / 1e6), off + 8]; }
    case TYPE.UUID:   return [buf.subarray(off, off + 16).toString('hex'), off + 16];
    case TYPE.DATA: {
      const len = buf.readUInt32LE(off); off += 4;
      const data = buf.subarray(off, off + len);
      return [data, off + align4(len)];
    }
    case TYPE.STRING: {
      const len = buf.readUInt32LE(off); off += 4;
      const s = buf.subarray(off, off + len - 1).toString('utf8');
      return [s, off + align4(len)];
    }
    case TYPE.ARRAY: {
      const totalBytes = buf.readUInt32LE(off); off += 4;
      const end = off + totalBytes;
      const count = buf.readUInt32LE(off); off += 4;
      const arr: any[] = [];
      for (let i = 0; i < count; i++) {
        const [v, next] = decodeObj(buf, off);
        arr.push(v); off = next;
      }
      return [arr, end];
    }
    case TYPE.DICTIONARY: {
      const totalBytes = buf.readUInt32LE(off); off += 4;
      const end = off + totalBytes;
      const count = buf.readUInt32LE(off); off += 4;
      const dict: Record<string, any> = {};
      for (let i = 0; i < count; i++) {
        const [k, afterKey] = readCString(buf, off); off = afterKey;
        const [v, afterVal] = decodeObj(buf, off); off = afterVal;
        dict[k] = v;
      }
      return [dict, end];
    }
    case TYPE.FILE_TRANSFER: {
      const msgId = buf.readBigUInt64LE(off); off += 8;
      const [data, next] = decodeObj(buf, off);
      return [{ __fileTransfer: true, msgId: Number(msgId), data }, next];
    }
    default:
      throw new Error(`Unknown XPC type 0x${type.toString(16)}`);
  }
}

export function decodeXpcWrapper(buf: Buffer): { flags: number; messageId: bigint; payload: any } | null {
  if (buf.length < 16) return null;
  const magic = buf.readUInt32LE(0);
  if (magic !== XPC_WRAPPER_MAGIC) throw new Error(`Bad XPC magic: 0x${magic.toString(16)}`);
  const flags = buf.readUInt32LE(4);
  const totalSize = buf.readBigUInt64LE(8); // includes the 8-byte message_id + payload
  const messageId = buf.readBigUInt64LE(16);
  if (!(flags & XpcFlags.DATA_PRESENT)) return { flags, messageId, payload: null };
  // XpcPayload starts at offset 24
  let off = 24;
  const pm = buf.readUInt32LE(off); off += 4;
  if (pm !== XPC_PAYLOAD_MAGIC) throw new Error(`Bad payload magic: 0x${pm.toString(16)}`);
  const pv = buf.readUInt32LE(off); off += 4;
  if (pv !== XPC_PAYLOAD_VERSION) throw new Error(`Bad payload version: ${pv}`);
  const [obj] = decodeObj(buf, off);
  return { flags, messageId, payload: obj };
}

// ─── encode ───────────────────────────────────────────────────────────────────

function encodeObj(val: any): Buffer {
  if (val === null || val === undefined) {
    const b = Buffer.alloc(4); b.writeUInt32LE(TYPE.NULL, 0); return b;
  }
  if (typeof val === 'boolean') {
    const b = Buffer.alloc(8); b.writeUInt32LE(TYPE.BOOL, 0); b.writeUInt32LE(val ? 1 : 0, 4); return b;
  }
  if (typeof val === 'number') {
    const b = Buffer.alloc(12); b.writeUInt32LE(TYPE.INT64, 0); b.writeBigInt64LE(BigInt(val), 4); return b;
  }
  if (typeof val === 'bigint') {
    const b = Buffer.alloc(12); b.writeUInt32LE(TYPE.UINT64, 0); b.writeBigUInt64LE(val, 4); return b;
  }
  if (typeof val === 'string') {
    const strBuf = Buffer.from(val + '\0', 'utf8');
    const aligned = align4(strBuf.length);
    const b = Buffer.alloc(8 + aligned);
    b.writeUInt32LE(TYPE.STRING, 0);
    b.writeUInt32LE(strBuf.length, 4);
    strBuf.copy(b, 8);
    return b;
  }
  if (Buffer.isBuffer(val)) {
    const aligned = align4(val.length);
    const b = Buffer.alloc(8 + aligned);
    b.writeUInt32LE(TYPE.DATA, 0);
    b.writeUInt32LE(val.length, 4);
    val.copy(b, 8);
    return b;
  }
  if (Array.isArray(val)) {
    const parts = val.map(encodeObj);
    const inner = Buffer.concat(parts);
    const b = Buffer.alloc(12 + inner.length);
    b.writeUInt32LE(TYPE.ARRAY, 0);
    b.writeUInt32LE(4 + inner.length, 4); // totalBytes = count + entries
    b.writeUInt32LE(val.length, 8);
    inner.copy(b, 12);
    return b;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    const entryBufs: Buffer[] = [];
    for (const k of keys) {
      const keyBuf = Buffer.from(k + '\0', 'utf8');
      const aligned = align4(keyBuf.length);
      const kbuf = Buffer.alloc(aligned);
      keyBuf.copy(kbuf);
      entryBufs.push(kbuf, encodeObj(val[k]));
    }
    const inner = Buffer.concat(entryBufs);
    const b = Buffer.alloc(12 + inner.length);
    b.writeUInt32LE(TYPE.DICTIONARY, 0);
    b.writeUInt32LE(4 + inner.length, 4);
    b.writeUInt32LE(keys.length, 8);
    inner.copy(b, 12);
    return b;
  }
  throw new TypeError(`Cannot encode XPC value: ${typeof val}`);
}

export function encodeXpcWrapper(payload: Record<string, any> | null, flags: number, messageId: bigint): Buffer {
  if (payload !== null && Object.keys(payload).length > 0) flags |= XpcFlags.DATA_PRESENT;
  flags |= XpcFlags.ALWAYS_SET;

  let message: Buffer;
  if (payload !== null && (flags & XpcFlags.DATA_PRESENT)) {
    const objBuf = encodeObj(payload);
    const payloadBuf = Buffer.alloc(8 + objBuf.length);
    payloadBuf.writeUInt32LE(XPC_PAYLOAD_MAGIC, 0);
    payloadBuf.writeUInt32LE(XPC_PAYLOAD_VERSION, 4);
    objBuf.copy(payloadBuf, 8);
    const msgIdBuf = Buffer.alloc(8);
    msgIdBuf.writeBigUInt64LE(messageId, 0);
    message = Buffer.concat([msgIdBuf, payloadBuf]);
  } else {
    message = Buffer.alloc(8);
    message.writeBigUInt64LE(messageId, 0);
  }

  const wrapper = Buffer.alloc(16 + message.length);
  wrapper.writeUInt32LE(XPC_WRAPPER_MAGIC, 0);
  wrapper.writeUInt32LE(flags, 4);
  wrapper.writeBigUInt64LE(BigInt(8 + message.length), 8); // size = message_id(8) + rest
  message.copy(wrapper, 16);
  return wrapper;
}

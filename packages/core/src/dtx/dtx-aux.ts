/**
 * DTX aux argument list encoding/decoding.
 *
 * Wire format: PrimitiveDictionary { PNULL_key → [arg0, arg1, ...] }
 *
 * Header: u32 magic(0x1F0) + u32 flags(0) + u64 body_len
 * Each entry: [key=PNull(tag:10)] [value=Primitive]
 *
 * Primitive value encoding:
 *   10 = Null         (tag only, no value)
 *   1  = String       u32 tag + u32 len + utf8
 *   2  = Buffer       u32 tag + u32 len + bytes
 *   3  = Int32        u32 tag + i32
 *   6  = Int64        u32 tag + u32 size(8) + i64
 *   9  = Double       u32 tag + f64
 *   0xF0 = NestedDict (for complex objects — archived as Buffer)
 */

const PDICT_MAGIC = 0x1F0;
const PNULL_TAG = 10;
const PSTRING_TAG = 1;
const PBUFFER_TAG = 2;
const PINT32_TAG = 3;
const PINT64_TAG = 6;
const PDOUBLE_TAG = 9;

function encodePNull(): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(PNULL_TAG, 0);
  return b;
}

function encodeValue(arg: any): Buffer {
  if (arg === null || arg === undefined) return encodePNull();
  if (typeof arg === 'string') {
    const str = Buffer.from(arg, 'utf8');
    const b = Buffer.alloc(8 + str.length);
    b.writeUInt32LE(PSTRING_TAG, 0);
    b.writeUInt32LE(str.length, 4);
    str.copy(b, 8);
    return b;
  }
  if (Buffer.isBuffer(arg)) {
    const b = Buffer.alloc(8 + arg.length);
    b.writeUInt32LE(PBUFFER_TAG, 0);
    b.writeUInt32LE(arg.length, 4);
    arg.copy(b, 8);
    return b;
  }
  if (typeof arg === 'bigint') {
    const b = Buffer.alloc(12);
    b.writeUInt32LE(PINT64_TAG, 0);
    b.writeUInt32LE(8, 4);
    b.writeBigInt64LE(arg, 8);
    return b;
  }
  if (Number.isInteger(arg)) {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(PINT32_TAG, 0);
    b.writeInt32LE(arg as number, 4);
    return b;
  }
  // float
  const b = Buffer.alloc(12);
  b.writeUInt32LE(PDOUBLE_TAG, 0);
  b.writeDoubleLE(arg as number, 4);
  return b;
}

export function encodeAux(args: any[]): Buffer {
  if (args.length === 0) return Buffer.alloc(0);
  const bodyParts: Buffer[] = [];
  for (const arg of args) {
    bodyParts.push(encodePNull());
    bodyParts.push(encodeValue(arg));
  }
  const body = Buffer.concat(bodyParts);
  const hdr = Buffer.alloc(16);
  hdr.writeUInt32LE(PDICT_MAGIC, 0);
  hdr.writeUInt32LE(0, 4);
  hdr.writeBigUInt64LE(BigInt(body.length), 8);
  return Buffer.concat([hdr, body]);
}

export function decodeAux(buf: Buffer): any[] {
  if (buf.length < 16) return [];
  const magic = buf.readUInt32LE(0);
  if (magic !== PDICT_MAGIC) return [];
  const bodyLen = Number(buf.readBigUInt64LE(8));
  const args: any[] = [];
  let pos = 16;
  const end = Math.min(16 + bodyLen, buf.length);
  while (pos < end) {
    const keyTag = buf.readUInt32LE(pos); pos += 4;
    if (keyTag !== PNULL_TAG) break;
    if (pos >= end) break;
    const tag = buf.readUInt32LE(pos); pos += 4;
    if (tag === PNULL_TAG) {
      args.push(null);
    } else if (tag === PSTRING_TAG) {
      const len = buf.readUInt32LE(pos); pos += 4;
      args.push(buf.subarray(pos, pos + len).toString('utf8')); pos += len;
    } else if (tag === PBUFFER_TAG) {
      const len = buf.readUInt32LE(pos); pos += 4;
      args.push(Buffer.from(buf.subarray(pos, pos + len))); pos += len;
    } else if (tag === PINT32_TAG) {
      args.push(buf.readInt32LE(pos)); pos += 4;
    } else if (tag === PINT64_TAG) {
      pos += 4;
      args.push(buf.readBigInt64LE(pos)); pos += 8;
    } else if (tag === PDOUBLE_TAG) {
      args.push(buf.readDoubleLE(pos)); pos += 8;
    } else {
      break;
    }
  }
  return args;
}

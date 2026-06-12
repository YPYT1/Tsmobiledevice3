import { DTX_FRAGMENT_MAGIC, DTXFragmentHeader, FRAGMENT_HEADER_SIZE, MAX_FRAGMENT_SIZE, DTXTransportFlags } from './types';

export function parseFragmentHeader(buf: Buffer): DTXFragmentHeader {
  if (buf.readUInt32LE(0) !== DTX_FRAGMENT_MAGIC) throw new Error('Invalid DTX magic');
  return {
    magic: buf.readUInt32LE(0),
    headerSize: buf.readUInt32LE(4),
    index: buf.readUInt16LE(8),
    count: buf.readUInt16LE(10),
    dataSize: buf.readUInt32LE(12),
    identifier: buf.readUInt32LE(16),
    conversationIndex: buf.readUInt32LE(20),
    channelCode: buf.readInt32LE(24),
    flags: buf.readUInt32LE(28),
  };
}

export function buildFragmentHeader(
  index: number,
  count: number,
  dataSize: number,
  identifier: number,
  conversationIndex: number,
  channelCode: number,
  flags: number,
): Buffer {
  const buf = Buffer.alloc(FRAGMENT_HEADER_SIZE);
  buf.writeUInt32LE(DTX_FRAGMENT_MAGIC, 0);
  buf.writeUInt32LE(FRAGMENT_HEADER_SIZE, 4);
  buf.writeUInt16LE(index, 8);
  buf.writeUInt16LE(count, 10);
  buf.writeUInt32LE(dataSize, 12);
  buf.writeUInt32LE(identifier, 16);
  buf.writeUInt32LE(conversationIndex, 20);
  buf.writeInt32LE(channelCode, 24);
  buf.writeUInt32LE(flags, 28);
  return buf;
}

export function buildPayloadHeader(msgType: number, auxSize: number, totalSize: number, flags: number): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeUInt8(msgType, 0);
  buf.writeUInt32LE(auxSize, 4);
  buf.writeUInt32LE(totalSize, 8);
  buf.writeUInt32LE(flags, 12);
  return buf;
}

export function fragmentPayload(
  payload: Buffer,
  identifier: number,
  conversationIndex: number,
  channelCode: number,
  flags: number,
): Buffer[] {
  const MAX_BODY = MAX_FRAGMENT_SIZE - FRAGMENT_HEADER_SIZE;
  const chunks: Buffer[] = [];
  for (let i = 0; i < payload.length; i += MAX_BODY) chunks.push(payload.subarray(i, i + MAX_BODY));
  if (chunks.length === 0) chunks.push(Buffer.alloc(0));

  return chunks.map((chunk, idx) => {
    const hdr = buildFragmentHeader(idx, chunks.length, chunk.length, identifier, conversationIndex, channelCode, idx === 0 ? flags : 0);
    return Buffer.concat([hdr, chunk]);
  });
}

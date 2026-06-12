// Minimal HTTP/2 frame codec — only the frame types used by remoted

export const FRAME_HEADER_SIZE = 9;

export const FrameType = {
  DATA:          0x0,
  HEADERS:       0x1,
  SETTINGS:      0x4,
  WINDOW_UPDATE: 0x8,
  RST_STREAM:    0x3,
  GOAWAY:        0x7,
} as const;

export const HTTP2_MAGIC = Buffer.from('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n', 'ascii');

export interface H2Frame {
  type: number;
  flags: number;
  streamId: number;
  payload: Buffer;
}

export function buildFrame(type: number, flags: number, streamId: number, payload: Buffer): Buffer {
  const buf = Buffer.alloc(FRAME_HEADER_SIZE + payload.length);
  buf.writeUInt16BE(payload.length >> 8, 0);
  buf.writeUInt8(payload.length & 0xff, 2);
  buf.writeUInt8(type, 3);
  buf.writeUInt8(flags, 4);
  buf.writeUInt32BE(streamId & 0x7fffffff, 5);
  payload.copy(buf, FRAME_HEADER_SIZE);
  return buf;
}

export function buildSettings(settings: Record<number, number>): Buffer {
  const payload = Buffer.alloc(Object.keys(settings).length * 6);
  let off = 0;
  for (const [id, val] of Object.entries(settings)) {
    payload.writeUInt16BE(Number(id), off); off += 2;
    payload.writeUInt32BE(val, off); off += 4;
  }
  return buildFrame(FrameType.SETTINGS, 0, 0, payload);
}

export function buildSettingsAck(): Buffer {
  return buildFrame(FrameType.SETTINGS, 0x1, 0, Buffer.alloc(0));
}

export function buildWindowUpdate(streamId: number, increment: number): Buffer {
  const p = Buffer.alloc(4);
  p.writeUInt32BE(increment & 0x7fffffff, 0);
  return buildFrame(FrameType.WINDOW_UPDATE, 0, streamId, p);
}

export function buildHeaders(streamId: number): Buffer {
  // END_HEADERS = 0x4
  return buildFrame(FrameType.HEADERS, 0x4, streamId, Buffer.alloc(0));
}

export function buildData(streamId: number, data: Buffer, endStream = false): Buffer {
  return buildFrame(FrameType.DATA, endStream ? 0x1 : 0, streamId, data);
}

/** Parse one H2 frame from a buffer. Returns [frame, bytesConsumed] or null if not enough data. */
export function parseFrame(buf: Buffer): [H2Frame, number] | null {
  if (buf.length < FRAME_HEADER_SIZE) return null;
  const len = (buf.readUInt8(0) << 16) | (buf.readUInt8(1) << 8) | buf.readUInt8(2);
  const total = FRAME_HEADER_SIZE + len;
  if (buf.length < total) return null;
  return [{
    type: buf.readUInt8(3),
    flags: buf.readUInt8(4),
    streamId: buf.readUInt32BE(5) & 0x7fffffff,
    payload: buf.subarray(FRAME_HEADER_SIZE, total),
  }, total];
}

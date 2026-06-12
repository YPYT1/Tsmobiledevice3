export const DTX_FRAGMENT_MAGIC = 0x1F3D5B79;
export const MAX_FRAGMENT_SIZE = 128 * 1024;
export const MAX_MESSAGE_SIZE = 128 * 1024 * 1024;
export const FRAGMENT_HEADER_SIZE = 32;
export const PAYLOAD_HEADER_SIZE = 16;

export const enum DTXMessageType {
  OK = 0,
  DATA = 1,
  DISPATCH = 2,
  OBJECT = 3,
  ERROR = 4,
  BARRIER = 5,
  PRIMITIVE = 6,
  COMPRESSED = 7,
  PROXIED_MESSAGE = 8,
}

export const enum DTXTransportFlags {
  NONE = 0,
  EXPECTS_REPLY = 1,
}

export interface DTXFragmentHeader {
  magic: number;
  headerSize: number;
  index: number;
  count: number;
  dataSize: number;
  identifier: number;
  conversationIndex: number;
  channelCode: number;
  flags: number;
}

export interface DTXPayloadHeader {
  msgType: number;
  auxSize: number;
  totalSize: number;
  flags: number;
}

export interface DTXMessage {
  identifier: number;
  conversationIndex: number;
  channelCode: number;
  flags: number;
  payloadHeader: DTXPayloadHeader;
  auxData: Buffer;
  payloadData: Buffer;
}

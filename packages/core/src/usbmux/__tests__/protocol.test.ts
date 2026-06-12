import plist from 'plist';
import { UsbMuxMessageType, UsbMuxVersion } from '../types';
import { MuxDevice } from '../MuxDevice';

function buildPlistPacket(data: any, tag: number): Buffer {
  const payload = Buffer.from(plist.build(data), 'utf8');
  const packet = Buffer.alloc(16 + payload.length);
  packet.writeUInt32LE(packet.length, 0);
  packet.writeUInt32LE(UsbMuxVersion.PLIST, 4);
  packet.writeUInt32LE(UsbMuxMessageType.PLIST, 8);
  packet.writeUInt32LE(tag, 12);
  payload.copy(packet, 16);
  return packet;
}

describe('usbmux packet encoding', () => {
  it('encodes header fields as little-endian', () => {
    const tag = 42;
    const data = { MessageType: 'ListDevices' };
    const packet = buildPlistPacket(data, tag);

    expect(packet.readUInt32LE(0)).toBe(packet.length);
    expect(packet.readUInt32LE(4)).toBe(UsbMuxVersion.PLIST);
    expect(packet.readUInt32LE(8)).toBe(UsbMuxMessageType.PLIST);
    expect(packet.readUInt32LE(12)).toBe(tag);
  });

  it('payload follows the 16-byte header', () => {
    const data = { MessageType: 'ReadBUID' };
    const packet = buildPlistPacket(data, 1);
    const payloadStr = packet.subarray(16).toString('utf8');
    const parsed = plist.parse(payloadStr) as any;
    expect(parsed.MessageType).toBe('ReadBUID');
  });
});

describe('MuxDevice.matchesUdid', () => {
  it('matches serial with dashes against udid without dashes', () => {
    const dev = new MuxDevice(1, '00008030-001234567890ABCD', 'USB');
    expect(dev.matchesUdid('00008030001234567890ABCD')).toBe(true);
  });

  it('matches both with dashes', () => {
    const dev = new MuxDevice(1, '00008030-001234567890ABCD', 'USB');
    expect(dev.matchesUdid('00008030-001234567890ABCD')).toBe(true);
  });

  it('returns false for different udid', () => {
    const dev = new MuxDevice(1, '00008030-001234567890ABCD', 'USB');
    expect(dev.matchesUdid('FFFFFFFF-FFFFFFFFFFFF')).toBe(false);
  });
});

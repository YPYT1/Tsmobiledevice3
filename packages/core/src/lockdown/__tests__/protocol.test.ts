import plist from 'plist';

function buildLockdownPacket(msg: any): Buffer {
  const payload = Buffer.from(plist.build(msg), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length, 0);
  return Buffer.concat([len, payload]);
}

describe('lockdown packet encoding', () => {
  it('length prefix is big-endian', () => {
    const msg = { Label: 'ts-mobiledevice', Request: 'GetValue' };
    const packet = buildLockdownPacket(msg);
    const encodedLen = packet.readUInt32BE(0);
    const actualPayloadLen = packet.length - 4;
    expect(encodedLen).toBe(actualPayloadLen);
  });

  it('payload parses back to original message', () => {
    const msg = { Label: 'ts-mobiledevice', Request: 'GetValue', Key: 'ProductVersion' };
    const packet = buildLockdownPacket(msg);
    const payloadLen = packet.readUInt32BE(0);
    const payload = packet.subarray(4, 4 + payloadLen);
    const parsed = plist.parse(payload.toString('utf8')) as any;
    expect(parsed.Request).toBe('GetValue');
    expect(parsed.Key).toBe('ProductVersion');
  });

  it('parses a known plist response', () => {
    const responseXml = plist.build({ Request: 'GetValue', Value: '17.0' });
    const payload = Buffer.from(responseXml, 'utf8');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    const packet = Buffer.concat([len, payload]);

    const size = packet.readUInt32BE(0);
    const parsed = plist.parse(packet.subarray(4, 4 + size).toString('utf8')) as any;
    expect(parsed.Value).toBe('17.0');
  });
});

// BUG-07: _verifyResponse must map InvalidHostID to InvalidHostIDError
describe('LockdownClient error mapping', () => {
  it('throws InvalidHostIDError for InvalidHostID response', async () => {
    const { InvalidHostIDError } = await import('../../exceptions');
    const { LockdownClient } = await import('../LockdownClient');
    // Access private _verifyResponse via any-cast; no socket needed
    const client = new (LockdownClient as any)({} as any);
    expect(() =>
      (client as any)._verifyResponse('GetValue', { Request: 'GetValue', Error: 'InvalidHostID' })
    ).toThrow(InvalidHostIDError);
  });

  it('throws NotPairedError for NotPaired response', async () => {
    const { NotPairedError } = await import('../../exceptions');
    const { LockdownClient } = await import('../LockdownClient');
    const client = new (LockdownClient as any)({} as any);
    expect(() =>
      (client as any)._verifyResponse('GetValue', { Request: 'GetValue', Error: 'NotPaired' })
    ).toThrow(NotPairedError);
  });
});

/**
 * Layer 5 Test: RemoteXPC / RSD protocol (iOS 17+)
 *
 * REQUIREMENTS:
 * - iOS 17+ device connected via USB with an IPv6 tunnel established
 * - OR direct TCP access to device on port 58783
 *
 * NOTE: This test requires a device running iOS 17+.
 * For iOS 16 devices, the RSD port (58783) is not exposed over usbmux.
 * You must first establish a tunnel: `pymobiledevice3 remote start-tunnel`
 * which exposes the device via a local IPv6 address.
 */

import { RemoteServiceDiscovery, RSD_PORT } from '../src/remote/RemoteServiceDiscovery';
import { encodeXpcWrapper, decodeXpcWrapper, XpcFlags } from '../src/remote/xpc';

describe('Layer 5: RemoteXPC / RSD', () => {
  describe('XPC codec (unit tests)', () => {
    test('roundtrip: simple dictionary', () => {
      const obj = { hello: 'world', num: 42, flag: true };
      const buf = encodeXpcWrapper(obj, 0, 0n);
      const result = decodeXpcWrapper(buf);
      expect(result).not.toBeNull();
      expect(result!.payload).toEqual(obj);
    });

    test('roundtrip: nested types', () => {
      const obj = { arr: [1, 2, 3], nested: { x: 'y' }, data: Buffer.from([0xde, 0xad]) };
      const buf = encodeXpcWrapper(obj, 0, 5n);
      const result = decodeXpcWrapper(buf);
      expect(result!.messageId).toBe(5n);
      expect(result!.payload.arr).toEqual([1, 2, 3]);
      expect(result!.payload.nested).toEqual({ x: 'y' });
      expect(Buffer.isBuffer(result!.payload.data)).toBe(true);
    });

    test('roundtrip: null payload', () => {
      const buf = encodeXpcWrapper(null, XpcFlags.INIT_HANDSHAKE, 1n);
      const result = decodeXpcWrapper(buf);
      expect(result!.flags & XpcFlags.INIT_HANDSHAKE).toBeTruthy();
      expect(result!.payload).toBeNull();
    });

    test('flags: WANTING_REPLY is set', () => {
      const buf = encodeXpcWrapper({ cmd: 'test' }, XpcFlags.WANTING_REPLY, 0n);
      const result = decodeXpcWrapper(buf);
      expect(result!.flags & XpcFlags.WANTING_REPLY).toBeTruthy();
      expect(result!.flags & XpcFlags.ALWAYS_SET).toBeTruthy();
    });
  });

  describe('RSD connection (requires iOS 17+ tunnel)', () => {
    // These tests require a tunnel. They skip gracefully if the device is unreachable.
    const RSD_HOST = process.env['RSD_HOST'] ?? '::1';
    const RSD_PORT_ENV = process.env['RSD_PORT'] ? parseInt(process.env['RSD_PORT']) : RSD_PORT;

    test('should connect and receive peerInfo', async () => {
      const rsd = new RemoteServiceDiscovery(RSD_HOST, RSD_PORT_ENV);
      try {
        await rsd.connect();
        expect(rsd.peerInfo).toBeDefined();
        expect(rsd.udid).toBeTruthy();
        expect(rsd.productVersion).toMatch(/^\d+\.\d+/);
        console.log('RSD UDID:', rsd.udid);
        console.log('RSD iOS version:', rsd.productVersion);
        console.log('RSD services:', Object.keys(rsd.peerInfo?.Services ?? {}).slice(0, 5));
      } catch (e: any) {
        if (e.code === 'ECONNREFUSED' || e.message.includes('timeout')) {
          console.warn('Skipping: RSD not reachable. Start tunnel with: pymobiledevice3 remote start-tunnel');
          return;
        }
        throw e;
      } finally {
        rsd.close();
      }
    }, 15000);
  });
});

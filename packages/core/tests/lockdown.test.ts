/**
 * Layer 2 Test: lockdown protocol
 *
 * REQUIREMENTS:
 * - Windows 10/11 with iTunes installed (for AMDS on port 27015)
 * - OR Linux/macOS with usbmuxd running
 * - At least one iOS device connected and paired via USB
 */

import { LockdownService } from '../src/lockdown';

describe('Layer 2: lockdown protocol', () => {
  let service: LockdownService | null = null;

  afterEach(async () => {
    if (service) {
      await service.close();
      service = null;
    }
  });

  test('should connect and initialize lockdown on first device', async () => {
    service = await LockdownService.create();

    expect(service).toBeDefined();
    expect(service.udid).toBeTruthy();
    expect(service.productVersion).toMatch(/^\d+\.\d+/);

    console.log('Device UDID:', service.udid);
    console.log('Product Version:', service.productVersion);
    console.log('Product Type:', service.productType);
  }, 20000);

  test('should get device values via getValue', async () => {
    service = await LockdownService.create();

    const deviceName = await service.getValue('DeviceName');
    expect(typeof deviceName).toBe('string');
    expect(deviceName.length).toBeGreaterThan(0);
    console.log('Device Name:', deviceName);

    const allValues = await service.getValue();
    expect(allValues).toBeDefined();
    expect(typeof allValues).toBe('object');
  }, 20000);

  test('should fail gracefully for unknown UDID', async () => {
    await expect(LockdownService.create('0000000000000000000000000000000000000000')).rejects.toThrow(
      'Device not found'
    );
  }, 20000);

  test('should start a service (com.apple.afc)', async () => {
    service = await LockdownService.create();

    const { port, enableSSL } = await service.startService('com.apple.afc');
    expect(typeof port).toBe('number');
    expect(port).toBeGreaterThan(0);
    console.log('AFC service port:', port, 'SSL:', enableSSL);
  }, 20000);
});

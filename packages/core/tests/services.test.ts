/**
 * Layer 3 Test: services
 *
 * REQUIREMENTS:
 * - At least one iOS device connected and paired via USB
 */

import { LockdownService } from '../src/lockdown';
import { ServiceFactory } from '../src/services/ServiceFactory';

describe('Layer 3: services', () => {
  let lockdown: LockdownService;
  let factory: ServiceFactory;

  beforeAll(async () => {
    lockdown = await LockdownService.create();
    factory = new ServiceFactory(lockdown);
  });

  afterAll(async () => {
    await lockdown.close();
  });

  test('AFC: list root directory', async () => {
    const afc = await factory.afc();
    try {
      const entries = await afc.listdir('/');
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
      console.log('AFC /:', entries.slice(0, 5));
    } finally {
      await afc.close();
    }
  }, 20000);

  test('AFC: get device info', async () => {
    const afc = await factory.afc();
    try {
      const info = await afc.getDeviceInfo();
      expect(info).toBeDefined();
      console.log('AFC device info:', info);
    } finally {
      await afc.close();
    }
  }, 20000);

  test('Screenshot: take a screenshot', async () => {
    let svc: any;
    try {
      svc = await factory.screenshot();
    } catch (e: any) {
      console.warn('Skipping screenshot: service unavailable (DeveloperDiskImage not mounted?):', e.message);
      return;
    }
    try {
      const data = await svc.takeScreenshot();
      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data.length).toBeGreaterThan(1000);
      console.log(`Screenshot size: ${data.length} bytes`);
    } finally {
      await svc.close();
    }
  }, 30000);

  test('SpringBoard: get icon state', async () => {
    const svc = await factory.springBoard();
    try {
      const state = await svc.getIconState();
      expect(state).toBeDefined();
      console.log('SpringBoard icon pages:', Array.isArray(state) ? state.length : typeof state);
    } finally {
      await svc.close();
    }
  }, 20000);

  test('Diagnostics: get battery info', async () => {
    const svc = await factory.diagnostics();
    try {
      const result = await svc.getBattery();
      expect(result).toBeDefined();
      console.log('Battery:', result);
    } finally {
      await svc.close();
    }
  }, 20000);
});

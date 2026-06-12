/**
 * Layer 4 Test: DTX protocol (DVT services)
 *
 * REQUIREMENTS:
 * - At least one iOS device connected and paired via USB
 * - DeveloperDiskImage mounted (or iOS 17+ with auto-mount)
 */

import { LockdownService } from '../src/lockdown';
import { DvtFactory } from '../src/dtx/DvtFactory';

describe('Layer 4: DTX / DVT services', () => {
  let lockdown: LockdownService;
  let dvt: DvtFactory | undefined;

  beforeAll(async () => {
    try {
      lockdown = await LockdownService.create();
      dvt = await DvtFactory.create(lockdown);
    } catch (e: any) {
      console.warn('DTX setup failed (DeveloperDiskImage not mounted?):', e.message);
    }
  }, 30000);

  afterAll(async () => {
    dvt?.close();
    await lockdown?.close();
  });

  test('DeviceInfo: systemInformation', async () => {
    if (!dvt) return console.warn('Skipping: DVT unavailable');
    const svc = await dvt.deviceInfo();
    try {
      const info = await svc.systemInformation();
      expect(info).toBeDefined();
      if (info && !info._nsError) console.log('systemInformation keys:', Object.keys(info).slice(0, 5));
      else console.warn('systemInformation returned NSError');
    } finally { await svc.close(); }
  }, 20000);

  test('DeviceInfo: proclist', async () => {
    if (!dvt) return console.warn('Skipping: DVT unavailable');
    const svc = await dvt.deviceInfo();
    try {
      const procs = await svc.proclist();
      expect(Array.isArray(procs)).toBe(true);
      expect(procs.length).toBeGreaterThan(0);
      console.log(`proclist: ${procs.length} processes, first:`, procs[0]);
    } finally { await svc.close(); }
  }, 20000);

  test('ApplicationListing: applist', async () => {
    if (!dvt) return console.warn('Skipping: DVT unavailable');
    const svc = await dvt.applicationListing();
    try {
      const apps = await svc.applist();
      expect(Array.isArray(apps)).toBe(true);
      expect(apps.length).toBeGreaterThan(0);
      console.log(`applist: ${apps.length} apps, first:`, apps[0]?.CFBundleIdentifier ?? apps[0]);
    } finally { await svc.close(); }
  }, 20000);

  test('Screenshot (DVT): take screenshot', async () => {
    if (!dvt) return console.warn('Skipping: DVT unavailable');
    const svc = await dvt.screenshot();
    try {
      const data = await svc.takeScreenshot();
      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data.length).toBeGreaterThan(1000);
      console.log(`DVT screenshot size: ${data.length} bytes`);
    } finally { await svc.close(); }
  }, 20000);
});

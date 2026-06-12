import path from 'path';
import { execFileSync } from 'child_process';
import { LockdownService } from '../lockdown/LockdownService';
import { ServiceFactory } from '../services/ServiceFactory';
import { DvtFactory } from '../dtx/DvtFactory';
import { AfcService } from '../services/AfcService';
import { InstallationProxy } from '../services/InstallationProxy';

async function withLockdown<T>(udid: string, fn: (svc: LockdownService) => Promise<T>): Promise<T> {
  const svc = await LockdownService.create(udid);
  try {
    return await fn(svc);
  } finally {
    svc.close();
  }
}

function findPython(): string {
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Python', 'Python311', 'python.exe')]
    : ['python3', 'python'];
  for (const p of candidates) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch { /* next */ }
  }
  return 'python';
}

export class Device {
  readonly udid: string;
  readonly connectionType: 'USB' | 'Network';
  readonly ipAddress?: string;
  private readonly devid: number;
  private _infoPromise?: Promise<{ udid: string; deviceName: string; productVersion: string; productType: string; serialNumber: string; ipAddress?: string }>;

  constructor(devid: number, udid: string, connectionType: 'USB' | 'Network', ipAddress?: string) {
    this.devid = devid;
    this.udid = udid;
    this.connectionType = connectionType;
    this.ipAddress = ipAddress;
  }

  get info() {
    if (!this._infoPromise) {
      this._infoPromise = withLockdown(this.udid, async (svc) => {
        const [deviceName, serialNumber] = await Promise.all([
          svc.getValue('DeviceName') as Promise<string>,
          svc.getValue('SerialNumber') as Promise<string>,
        ]);
        return {
          udid: this.udid,
          deviceName,
          productVersion: svc.productVersion,
          productType: svc.productType ?? '',
          serialNumber,
          ipAddress: this.ipAddress,
        };
      });
    }
    return this._infoPromise;
  }

  async screenshot(): Promise<Buffer> {
    const python = findPython();

    execFileSync(python, [
      '-m', 'pymobiledevice3', 'mounter', 'auto-mount', '--udid', this.udid,
    ], { stdio: 'ignore' });

    return withLockdown(this.udid, async (svc) => {
      const dvt = await DvtFactory.create(svc);
      try {
        const screenshotSvc = await dvt.screenshot();
        const buf = await screenshotSvc.takeScreenshot();
        await screenshotSvc.close();
        return buf;
      } finally {
        dvt.close();
      }
    });
  }

  async processes(): Promise<Array<{ pid: number; name: string; path: string }>> {
    return withLockdown(this.udid, async (svc) => {
      const dvt = await DvtFactory.create(svc);
      try {
        const devInfo = await dvt.deviceInfo();
        const list = await devInfo.proclist();
        await devInfo.close();
        return list.map((p: { pid: number; name: string; realAppName?: string }) => ({ pid: p.pid, name: p.name, path: p.realAppName ?? '' }));
      } finally {
        dvt.close();
      }
    });
  }

  async syslog(): Promise<AsyncGenerator<string>> {
    const svc = await LockdownService.create(this.udid);
    const factory = new ServiceFactory(svc);
    const syslogSvc = await factory.syslog();
    const gen = syslogSvc.lines();
    return (async function* () {
      try { yield* gen; } finally { await svc.close(); }
    })();
  }

  async afc(): Promise<AfcService> {
    const svc = await LockdownService.create(this.udid);
    const factory = new ServiceFactory(svc);
    const afcSvc = await factory.afc();
    const origClose = afcSvc.close.bind(afcSvc);
    afcSvc.close = async () => { await origClose(); svc.close(); };
    return afcSvc;
  }

  async apps(): Promise<InstallationProxy> {
    const svc = await LockdownService.create(this.udid);
    const factory = new ServiceFactory(svc);
    const appSvc = await factory.installationProxy();
    const origClose = appSvc.close.bind(appSvc);
    appSvc.close = async () => { await origClose(); svc.close(); };
    return appSvc;
  }

  async close(): Promise<void> {
    // Each method patches its returned service's close() to also close the lockdown connection.
  }
}

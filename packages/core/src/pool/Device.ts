import path from 'path';
import { execFileSync } from 'child_process';
import { LockdownService } from '../lockdown/LockdownService';
import { ServiceFactory } from '../services/ServiceFactory';
import { DvtFactory } from '../dtx/DvtFactory';
import { AfcService } from '../services/AfcService';
import { InstallationProxy } from '../services/InstallationProxy';

const PYTHON_PATH = path.join(__dirname, '..', '..', '..', '..', 'pymobiledevice3-master', '.venv', 'Scripts', 'python.exe');

async function withLockdown<T>(udid: string, fn: (svc: LockdownService) => Promise<T>): Promise<T> {
  const svc = await LockdownService.create(udid);
  try {
    return await fn(svc);
  } finally {
    svc.close();
  }
}

export class Device {
  readonly udid: string;
  readonly connectionType: 'USB' | 'Network';
  readonly ipAddress?: string;
  private readonly devid: number;
  private _info?: { udid: string; deviceName: string; productVersion: string; productType: string; serialNumber: string; ipAddress?: string };

  constructor(devid: number, udid: string, connectionType: 'USB' | 'Network', ipAddress?: string) {
    this.devid = devid;
    this.udid = udid;
    this.connectionType = connectionType;
    this.ipAddress = ipAddress;
  }

  get info(): Promise<{ udid: string; deviceName: string; productVersion: string; productType: string; serialNumber: string }> {
    if (this._info) return Promise.resolve(this._info);
    return withLockdown(this.udid, async (svc) => {
      const [deviceName, serialNumber] = await Promise.all([
        svc.getValue('DeviceName') as Promise<string>,
        svc.getValue('SerialNumber') as Promise<string>,
      ]);
      this._info = {
        udid: this.udid,
        deviceName,
        productVersion: svc.productVersion,
        productType: svc.productType ?? '',
        serialNumber,
        ipAddress: this.ipAddress,
      };
      return this._info;
    });
  }

  async screenshot(): Promise<Buffer> {
    const python = (() => {
      try {
        execFileSync(PYTHON_PATH, ['--version'], { stdio: 'ignore' });
        return PYTHON_PATH;
      } catch {
        return 'python';
      }
    })();

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
    return syslogSvc.lines();
  }

  async afc(): Promise<AfcService> {
    const svc = await LockdownService.create(this.udid);
    const factory = new ServiceFactory(svc);
    return factory.afc();
  }

  async apps(): Promise<InstallationProxy> {
    const svc = await LockdownService.create(this.udid);
    const factory = new ServiceFactory(svc);
    return factory.installationProxy();
  }

  async close(): Promise<void> {
    // no-op: each method creates and closes its own connection
  }
}

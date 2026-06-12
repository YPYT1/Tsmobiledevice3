import net from 'net';
import tls from 'tls';
import { LockdownService } from '../lockdown';
import { UsbMuxConnection } from '../usbmux/UsbMuxConnection';
import { PlistMuxConnection } from '../usbmux/PlistMuxConnection';
import { DvtServiceProvider } from './provider';
import { DeviceInfoService } from '../services/dvt/DeviceInfoService';
import { ProcessControlService } from '../services/dvt/ProcessControlService';
import { ApplicationListingService } from '../services/dvt/ApplicationListingService';
import { SysmontapService } from '../services/dvt/SysmontapService';
import { ScreenshotDvtService } from '../services/dvt/ScreenshotDvtService';
import { EnergyMonitorService } from '../services/dvt/EnergyMonitorService';
import { NetworkMonitorService } from '../services/dvt/NetworkMonitorService';
import { GraphicsService } from '../services/dvt/GraphicsService';
import { ConditionInducerService } from '../services/dvt/ConditionInducerService';

async function openDvtSocket(lockdown: LockdownService, usbmuxAddress?: string): Promise<net.Socket> {
  let serviceResult: { port: number; enableSSL: boolean } | null = null;
  for (const name of [DvtServiceProvider.RSD_SERVICE_NAME, DvtServiceProvider.SERVICE_NAME]) {
    try { serviceResult = await lockdown.startService(name); break; } catch { /* try next */ }
  }
  if (!serviceResult) throw new Error('No DVT service available');
  const { port: rawPort, enableSSL } = serviceResult;
  const portBuf = Buffer.allocUnsafe(2);
  portBuf.writeUInt16BE(rawPort, 0);
  const port = portBuf.readUInt16LE(0);
  const mux = (await UsbMuxConnection.create(usbmuxAddress)) as PlistMuxConnection;
  const socket = await mux.connectDevice(lockdown.device.devid, port);
  if (enableSSL && lockdown.client.pairRecord) {
    return new Promise<net.Socket>((resolve, reject) => {
      const s = tls.connect({
        socket: socket as net.Socket,
        rejectUnauthorized: false,
        cert: lockdown.client.pairRecord!.HostCertificate,
        key: lockdown.client.pairRecord!.HostPrivateKey,
      });
      const timer = setTimeout(() => { s.destroy(); reject(new Error('DVT TLS handshake timeout')); }, 10000);
      s.once('secureConnect', () => { clearTimeout(timer); resolve(s as unknown as net.Socket); });
      s.once('error', (e) => { clearTimeout(timer); reject(e); });
    });
  }
  return socket;
}

export class DvtFactory {
  private constructor(public readonly dvt: DvtServiceProvider) {}

  static async create(lockdown: LockdownService, usbmuxAddress?: string): Promise<DvtFactory> {
    const socket = await openDvtSocket(lockdown, usbmuxAddress);
    const dvt = new DvtServiceProvider(socket);
    await dvt.connect();
    return new DvtFactory(dvt);
  }

  deviceInfo()         { return DeviceInfoService.create(this.dvt); }
  processControl()     { return ProcessControlService.create(this.dvt); }
  applicationListing() { return ApplicationListingService.create(this.dvt); }
  sysmontap()          { return SysmontapService.create(this.dvt); }
  screenshot()         { return ScreenshotDvtService.create(this.dvt); }
  energyMonitor()      { return EnergyMonitorService.create(this.dvt); }
  networkMonitor()     { return NetworkMonitorService.create(this.dvt); }
  graphics()           { return GraphicsService.create(this.dvt); }
  conditionInducer()   { return ConditionInducerService.create(this.dvt); }

  close() { this.dvt.close(); }
}

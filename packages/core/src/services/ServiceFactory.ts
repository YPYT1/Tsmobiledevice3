import net from 'net';
import tls from 'tls';
import { LockdownService } from '../lockdown';
import { UsbMuxConnection } from '../usbmux/UsbMuxConnection';
import { PlistMuxConnection } from '../usbmux/PlistMuxConnection';

import { AfcService } from './AfcService';
import { SyslogService } from './SyslogService';
import { ScreenshotService } from './ScreenshotService';
import { SimulateLocationService } from './SimulateLocationService';
import { NotificationProxy } from './NotificationProxy';
import { InstallationProxy } from './InstallationProxy';
import { HeartbeatService } from './HeartbeatService';
import { DiagnosticsService } from './DiagnosticsService';
import { SpringBoardService } from './SpringBoardService';
import { MobileImageMounterService } from './MobileImageMounterService';
import { HouseArrestService } from './HouseArrestService';
import { CrashReportsManager } from './CrashReportsManager';
import { OsTraceService } from './OsTraceService';
import { PcapdService } from './PcapdService';
import { MobileBackup2Service } from './MobileBackup2Service';
import { WebInspectorService } from './WebInspectorService';
import { MobileConfigService } from './MobileConfigService';
import { MisagentService } from './MisagentService';
import { AmfiService } from './AmfiService';
import { DvtFactory } from '../dtx/DvtFactory';

async function openServiceSocket(
  lockdown: LockdownService,
  serviceName: string,
  usbmuxAddress?: string,
): Promise<net.Socket> {
  const { port: rawPort, enableSSL } = await lockdown.startService(serviceName);
  // lockdown returns port in big-endian; usbmux connectDevice expects little-endian
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
      s.once('secureConnect', () => resolve(s as unknown as net.Socket));
      s.once('error', reject);
    });
  }
  return socket;
}

export class ServiceFactory {
  constructor(
    private lockdown: LockdownService,
    private usbmuxAddress?: string,
  ) {}

  private async socket(name: string): Promise<net.Socket> {
    return openServiceSocket(this.lockdown, name, this.usbmuxAddress);
  }

  async afc(): Promise<AfcService> {
    return new AfcService(await this.socket('com.apple.afc'));
  }

  async syslog(): Promise<SyslogService> {
    return new SyslogService(await this.socket('com.apple.syslog_relay'));
  }

  async screenshot(): Promise<ScreenshotService> {
    return new ScreenshotService(await this.socket('com.apple.mobile.screenshotr'));
  }

  async simulateLocation(): Promise<SimulateLocationService> {
    return new SimulateLocationService(await this.socket('com.apple.dt.simulatelocation'));
  }

  async notificationProxy(): Promise<NotificationProxy> {
    return new NotificationProxy(await this.socket('com.apple.mobile.notification_proxy'));
  }

  async installationProxy(): Promise<InstallationProxy> {
    return new InstallationProxy(await this.socket('com.apple.mobile.installation_proxy'));
  }

  async heartbeat(): Promise<HeartbeatService> {
    return new HeartbeatService(await this.socket('com.apple.mobile.heartbeat'));
  }

  async diagnostics(): Promise<DiagnosticsService> {
    return new DiagnosticsService(await this.socket('com.apple.mobile.diagnostics_relay'));
  }

  async springBoard(): Promise<SpringBoardService> {
    return new SpringBoardService(await this.socket('com.apple.springboardservices'));
  }

  async imageMounter(): Promise<MobileImageMounterService> {
    return new MobileImageMounterService(await this.socket('com.apple.mobile.mobile_image_mounter'));
  }

  async houseArrest(bundleId: string, documentsOnly = false): Promise<HouseArrestService> {
    return HouseArrestService.open(await this.socket('com.apple.mobile.house_arrest'), bundleId, documentsOnly);
  }

  async crashReports(): Promise<CrashReportsManager> {
    return new CrashReportsManager(await this.socket('com.apple.crashreportcopymobile'));
  }

  async osTrace(): Promise<OsTraceService> {
    return new OsTraceService(await this.socket('com.apple.os_trace_relay'));
  }

  async pcapd(): Promise<PcapdService> {
    return new PcapdService(await this.socket('com.apple.pcapd'));
  }

  async mobileBackup2(): Promise<MobileBackup2Service> {
    return MobileBackup2Service.create(await this.socket('com.apple.mobilebackup2'));
  }

  async webInspector(): Promise<WebInspectorService> {
    return new WebInspectorService(await this.socket('com.apple.webinspector'));
  }

  async mobileConfig(): Promise<MobileConfigService> {
    return new MobileConfigService(await this.socket('com.apple.mobile.MCInstall'));
  }

  async misagent(): Promise<MisagentService> {
    return new MisagentService(await this.socket('com.apple.misagent'));
  }

  async amfi(): Promise<AmfiService> {
    return new AmfiService(await this.socket('com.apple.amfi.lockdown'));
  }

  async dvt(): Promise<DvtFactory> {
    return DvtFactory.create(this.lockdown, this.usbmuxAddress);
  }
}

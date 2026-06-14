import net from 'net';
import { UsbMuxConnection } from '../usbmux/UsbMuxConnection';
import { PlistMuxConnection } from '../usbmux/PlistMuxConnection';
import { MuxDevice } from '../usbmux/MuxDevice';
import { LOCKDOWN_PORT_USBMUX, LockdownClient, LockdownValue } from './LockdownClient';
import { NotPairedError } from '../exceptions';

export class LockdownService {
  private constructor(
    public readonly client: LockdownClient,
    public readonly device: MuxDevice,
  ) {}

  /** Connect to the first available device (or by UDID) and return a ready LockdownService. */
  static async create(udid?: string, usbmuxAddress?: string): Promise<LockdownService> {
    const mux = (await UsbMuxConnection.create(usbmuxAddress)) as PlistMuxConnection;
    let socket: net.Socket | undefined;
    try {
      const rawDevices = await mux.listDevices();
      const target = udid
        ? rawDevices.find(d => d.serial.replace(/-/g, '') === udid.replace(/-/g, ''))
        : rawDevices[0];
      if (!target) throw new Error(udid ? `Device not found: ${udid}` : 'No device connected');
      const device = new MuxDevice(target.devid, target.serial, target.connectionType as 'USB' | 'Network');
      let pairRecord: LockdownValue | undefined;
      try {
        pairRecord = await mux.getPairRecord(target.serial);
      } catch (e) {
        if (!(e instanceof NotPairedError)) throw e;
      }
      // BUG-03: inject real SystemBUID from usbmuxd; never use a hardcoded fallback
      if (pairRecord && !pairRecord.SystemBUID) {
        pairRecord.SystemBUID = await mux.getBuid();
      }
      socket = await mux.connectDevice(target.devid, LOCKDOWN_PORT_USBMUX);
      const client = await LockdownClient.create(socket, pairRecord);
      if (pairRecord) await client.validatePairing(pairRecord);
      return new LockdownService(client, device);
    } catch (e) {
      socket ? socket.destroy() : await mux.close();
      throw e;
    }
  }

  /** Perform lockdown pairing for a device (no existing pair record needed). */
  static async pair(udid?: string, usbmuxAddress?: string): Promise<void> {
    const mux = (await UsbMuxConnection.create(usbmuxAddress)) as PlistMuxConnection;
    let socket: net.Socket | undefined;
    try {
      const rawDevices = await mux.listDevices();
      const target = udid
        ? rawDevices.find(d => d.serial.replace(/-/g, '') === udid.replace(/-/g, ''))
        : rawDevices[0];
      if (!target) throw new Error(udid ? `Device not found: ${udid}` : 'No device connected');

      const systemBuid = await mux.getBuid();
      socket = await mux.connectDevice(target.devid, LOCKDOWN_PORT_USBMUX);
      // Create client without pair record — pairing doesn't require one
      const client = new LockdownClient(socket);
      await (client as any)._initialize();

      const { pairRecord, pairRecordData } = await client.pair(systemBuid);
      await mux.savePairRecord(target.serial, target.devid, pairRecordData);
      client['pairRecord'] = pairRecord;
    } finally {
      socket?.destroy();
      await mux.close();
    }
  }

  get udid(): string | null { return this.client.udid; }
  get productVersion(): string { return this.client.productVersion; }
  get productType(): string | null { return this.client.productType; }

  getValue(key?: string, domain?: string) { return this.client.getValue(key, domain); }
  startService(name: string) { return this.client.startService(name); }
  close() { return this.client.close(); }
}

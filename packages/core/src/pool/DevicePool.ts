import { EventEmitter } from 'events';
import { MuxDevice } from '../usbmux/MuxDevice';
import { PlistMuxConnection } from '../usbmux/PlistMuxConnection';
import { UsbMuxConnection } from '../usbmux/UsbMuxConnection';

export class DevicePool extends EventEmitter {
  private listenConn: PlistMuxConnection | null = null;

  private constructor(private devices: Map<string, MuxDevice>) {
    super();
  }

  static async connect(usbmuxAddress?: string): Promise<DevicePool> {
    // 1. List current devices
    const listConn = new PlistMuxConnection(
      await UsbMuxConnection.createUsbmuxSocket(usbmuxAddress)
    );
    let initialDevices: any[];
    try {
      initialDevices = await listConn.listDevices();
    } finally {
      await listConn.close();
    }

    const devices = new Map<string, MuxDevice>();
    for (const d of initialDevices) {
      devices.set(d.serial, new MuxDevice(d.devid, d.serial, d.connectionType, d.ipAddress));
    }

    const pool = new DevicePool(devices);

    // 2. Separate connection for hot-plug listening
    const listenConn = new PlistMuxConnection(
      await UsbMuxConnection.createUsbmuxSocket(usbmuxAddress)
    );
    pool.listenConn = listenConn;
    await listenConn.listen();

    // 3. Background loop
    (async () => {
      while (true) {
        try {
          const response = await listenConn.receive();
          if (response.MessageType === 'Attached') {
            const { DeviceID, Properties } = response;
            const device = new MuxDevice(DeviceID, Properties.SerialNumber, Properties.ConnectionType, Properties.EscapedFullServiceName?.match(/^([\d.a-fA-F:]+)@/)?.[1]);
            pool.devices.set(device.serial, device);
            pool.emit('device:connected', device);
          } else if (response.MessageType === 'Detached') {
            for (const [serial, d] of pool.devices) {
              if (d.devid === response.DeviceID) {
                pool.devices.delete(serial);
                pool.emit('device:disconnected', serial);
                break;
              }
            }
          }
        } catch (e) {
          pool._emitErrorSafe(e instanceof Error ? e : new Error(String(e)));
          break;
        }
      }
    })();

    return pool;
  }

  getDevices(): MuxDevice[] {
    return Array.from(this.devices.values());
  }

  getDevice(udid: string): MuxDevice | undefined {
    const normalized = udid.replace(/-/g, '');
    for (const d of this.devices.values()) {
      if (d.serial.replace(/-/g, '') === normalized) return d;
    }
    return undefined;
  }

  async broadcast<T>(fn: (device: MuxDevice) => Promise<T>): Promise<Array<{ udid: string; result?: T; error?: string }>> {
    const entries = Array.from(this.devices.values());
    const results = await Promise.allSettled(entries.map(fn));
    return results.map((r, i) =>
      r.status === 'fulfilled'
        ? { udid: entries[i].serial, result: r.value }
        : { udid: entries[i].serial, error: (r.reason as Error).message }
    );
  }

  // BUG-05: guard against unhandled 'error' event crashing the process
  _emitErrorSafe(err: Error): void {
    if (this.listenerCount('error') > 0) this.emit('error', err);
  }

  async close(): Promise<void> {
    await this.listenConn?.close();
    this.listenConn = null;
  }
}

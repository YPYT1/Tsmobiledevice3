/**
 * UsbMux device entity
 */

export class MuxDevice {
  public readonly devid: number;
  public readonly serial: string;
  public readonly connectionType: 'USB' | 'Network';
  public readonly ipAddress?: string;

  constructor(devid: number, serial: string, connectionType: 'USB' | 'Network', ipAddress?: string) {
    this.devid = devid;
    this.serial = serial;
    this.connectionType = connectionType;
    this.ipAddress = ipAddress;
  }

  /**
   * Check if device is connected via USB
   */
  get isUsb(): boolean {
    return this.connectionType === 'USB';
  }

  /**
   * Check if device is connected via Network (Wi-Fi)
   */
  get isNetwork(): boolean {
    return this.connectionType === 'Network';
  }

  /**
   * Check if this device matches the given UDID
   */
  matchesUdid(udid: string): boolean {
    const normalizedSerial = this.serial.replace(/-/g, '');
    const normalizedUdid = udid.replace(/-/g, '');
    return normalizedSerial === normalizedUdid;
  }
}

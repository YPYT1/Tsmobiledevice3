import { EventEmitter } from 'events';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const multicastDns: any = require('multicast-dns');

export interface BonjourDevice {
  ip: string;
  udid: string;
}

/**
 * Discovers iOS devices advertising _apple-mobdev2._tcp over mDNS (Wi-Fi).
 * Usage:
 *   const d = new BonjourDiscovery();
 *   d.on('device', ({ ip, udid }) => ...);
 *   await d.start();
 *   // later:
 *   d.stop();
 */
export class BonjourDiscovery extends EventEmitter {
  private _mdns: any = null;

  async start(): Promise<void> {
    this._mdns = multicastDns();

    this._mdns.on('response', (response: any) => {
      // Look for PTR records pointing to _apple-mobdev2._tcp.local
      const ptr = (response.answers ?? []).find(
        (a: any) => a.type === 'PTR' && a.name === '_apple-mobdev2._tcp.local'
      );
      if (!ptr) return;

      // The PTR data is like "<udid>@<host>._apple-mobdev2._tcp.local"
      const udidMatch = String(ptr.data).match(/^([0-9A-Fa-f-]{25,})/);
      const udid = udidMatch ? udidMatch[1] : ptr.data;

      // Resolve A record from additionals
      const aRecord = (response.additionals ?? []).find(
        (a: any) => a.type === 'A'
      );
      if (!aRecord) return;

      const device: BonjourDevice = { ip: aRecord.data, udid };
      this.emit('device', device);
    });

    // Query for the service
    this._mdns.query({
      questions: [{ name: '_apple-mobdev2._tcp.local', type: 'PTR' }],
    });
  }

  stop(): void {
    if (this._mdns) {
      this._mdns.destroy();
      this._mdns = null;
    }
  }
}

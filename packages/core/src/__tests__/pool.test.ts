import { EventEmitter } from 'events';
import { MuxDevice } from '../usbmux/MuxDevice';
import { DevicePool } from '../pool/DevicePool';

function makePool(devices: MuxDevice[]): DevicePool {
  const map = new Map<string, MuxDevice>(devices.map(d => [d.serial, d]));
  const pool = new (DevicePool as any)(map) as DevicePool;
  return pool;
}

describe('DevicePool.broadcast', () => {
  it('returns results for all devices', async () => {
    const d1 = new MuxDevice(1, 'AAA', 'USB');
    const d2 = new MuxDevice(2, 'BBB', 'USB');
    const pool = makePool([d1, d2]);

    const results = await pool.broadcast(async (d) => d.serial + '-ok');
    expect(results).toHaveLength(2);
    expect(results.find(r => r.udid === 'AAA')?.result).toBe('AAA-ok');
    expect(results.find(r => r.udid === 'BBB')?.result).toBe('BBB-ok');
  });

  it('one failure does not prevent other results', async () => {
    const d1 = new MuxDevice(1, 'AAA', 'USB');
    const d2 = new MuxDevice(2, 'BBB', 'USB');
    const pool = makePool([d1, d2]);

    const results = await pool.broadcast(async (d) => {
      if (d.serial === 'AAA') throw new Error('device error');
      return 'ok';
    });

    expect(results).toHaveLength(2);
    expect(results.find(r => r.udid === 'AAA')?.error).toBe('device error');
    expect(results.find(r => r.udid === 'BBB')?.result).toBe('ok');
  });
});

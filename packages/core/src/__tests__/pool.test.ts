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

describe('DevicePool error handling', () => {
  // BUG-05: emitting 'error' with no listener must NOT throw
  it('does not throw when error emitted and no listener attached', () => {
    const pool = makePool([]);
    // Emit error directly on internal emitter — simulate the background loop path
    expect(() => {
      // If DevicePool has no 'error' listener, EventEmitter throws by default.
      // Our fix guards with listenerCount before emitting.
      (pool as any)._emitErrorSafe(new Error('test error'));
    }).not.toThrow();
  });

  it('propagates error to listener when registered', () => {
    const pool = makePool([]);
    const errors: Error[] = [];
    pool.on('error', (e) => errors.push(e));
    (pool as any)._emitErrorSafe(new Error('boom'));
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('boom');
  });
});

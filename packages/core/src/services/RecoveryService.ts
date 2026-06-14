import { LockdownService } from '../lockdown/LockdownService';
import { MuxException } from '../exceptions';

export class RecoveryService {
  /**
   * Returns true if the device is in recovery mode.
   * A device in recovery mode responds to QueryType with a non-lockdown type.
   */
  static async isInRecovery(udid?: string): Promise<boolean> {
    let svc: LockdownService | null = null;
    try {
      svc = await LockdownService.create(udid);
      // If create succeeds, device is in normal lockdown mode
      return false;
    } catch (e) {
      // MuxException with "Unexpected lockdown type" means recovery/restore mode
      if (e instanceof MuxException && e.message.includes('Unexpected lockdown type')) return true;
      // Device not found or connection refused — can't determine
      throw e;
    } finally {
      await svc?.close();
    }
  }

  /**
   * Sends a diagnostics restart with the EnterRecovery flag.
   */
  static async enterRecovery(udid?: string): Promise<void> {
    const svc = await LockdownService.create(udid);
    try {
      const { port } = await svc.startService('com.apple.mobile.diagnostics_relay');
      // Send EnterRecovery request directly on the diagnostics socket
      const net = await import('net');
      const plist = await import('plist');
      const { readExactly } = await import('../utils/socket');

      const diagSocket = await new Promise<import('net').Socket>((resolve, reject) => {
        const s = net.default.createConnection({ host: '127.0.0.1', port }, () => resolve(s));
        s.once('error', reject);
      });

      const xml = plist.default.build({ Request: 'EnterRecovery' });
      const payload = Buffer.from(xml, 'utf8');
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32BE(payload.length, 0);
      await new Promise<void>((resolve, reject) =>
        diagSocket.write(Buffer.concat([lenBuf, payload]), (err) => (err ? reject(err) : resolve()))
      );
      // Read response (best-effort; device may disconnect immediately)
      try {
        const rLen = await readExactly(diagSocket, 4);
        const rPayload = await readExactly(diagSocket, rLen.readUInt32BE(0));
        const resp = plist.default.parse(rPayload.toString('utf8')) as any;
        if (resp.Status && resp.Status !== 'Success') {
          throw new Error(`EnterRecovery failed: ${resp.Status}`);
        }
      } catch { /* device likely disconnected — normal for recovery entry */ }
      diagSocket.destroy();
    } finally {
      await svc.close();
    }
  }

  /**
   * Recovery exit requires physical device interaction.
   */
  static getExitInstructions(): string {
    return [
      'To exit recovery mode manually:',
      '  iPhone with Face ID: Hold Side button until power-off slider appears, then release.',
      '  iPhone with Touch ID (no Home): Hold Side button until power-off slider appears, then release.',
      '  iPhone with Home button: Hold Home + Side (or Top) button for 10s until the Apple logo appears.',
      'Alternatively, connect to iTunes/Finder and click "Restore" or "Update".',
    ].join('\n');
  }
}

import net from 'net';
import plist from 'plist';
import { AfcService } from './AfcService';

export class CrashReportsManager extends AfcService {
  static readonly SERVICE_NAME = 'com.apple.crashreportcopymobile';
  static readonly RSD_SERVICE_NAME = 'com.apple.crashreportcopymobile.shim.remote';

  async listCrashReports(): Promise<string[]> {
    const entries: string[] = [];
    for await (const { path, isDir } of this.walk('/')) {
      if (!isDir && path.endsWith('.ips') || path.endsWith('.crash')) {
        entries.push(path);
      }
    }
    return entries;
  }

  async getCrashReport(path: string): Promise<Buffer> {
    return this.getFileContents(path);
  }

  async deleteCrashReport(path: string): Promise<void> {
    return this.rm(path);
  }

  async close(): Promise<void> {
    this.socket.destroy();
  }
}

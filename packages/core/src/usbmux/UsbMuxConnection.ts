/**
 * Base UsbMux connection - handles socket connection to usbmuxd daemon
 */

import net from 'net';
import {
  ConnectionFailedToUsbmuxdError,
  MuxException,
  MuxVersionError,
} from '../exceptions';
import { UsbMuxVersion } from './types';
import { readExactly } from '../utils/socket';

// Windows: iTunes AMDS
const ITUNES_HOST = '127.0.0.1';
const ITUNES_PORT = 27015;

// Linux/macOS: Unix socket
const USBMUXD_PIPE = '/var/run/usbmuxd';

export interface UsbmuxAddress {
  host?: string;
  port?: number;
  path?: string;
}

export abstract class UsbMuxConnection {
  protected socket: net.Socket | null = null;
  protected connected = false;
  protected tag = 1;
  protected devices: any[] = [];

  /**
   * Resolve usbmuxd address based on platform
   */
  private static resolveUsbmuxAddress(usbmuxAddress?: string): UsbmuxAddress {
    if (usbmuxAddress) {
      if (usbmuxAddress.includes(':')) {
        const [host, portStr] = usbmuxAddress.split(':');
        return { host, port: parseInt(portStr, 10) };
      }
      return { path: usbmuxAddress };
    }

    // Default addresses based on platform
    if (process.platform === 'win32') {
      // Windows: iTunes AMDS
      return { host: ITUNES_HOST, port: ITUNES_PORT };
    } else {
      // Linux/macOS: Unix socket
      return { path: USBMUXD_PIPE };
    }
  }

  /**
   * Create socket connection to usbmuxd daemon
   */
  public static async createUsbmuxSocket(usbmuxAddress?: string): Promise<net.Socket> {
    const address = UsbMuxConnection.resolveUsbmuxAddress(usbmuxAddress);

    const socket = new net.Socket();

    try {
      if (address.path) {
        // Unix socket connection
        await new Promise<void>((resolve, reject) => {
          socket.connect(address.path!, () => resolve());
          socket.once('error', reject);
        });
      } else if (address.host && address.port) {
        // TCP connection
        await new Promise<void>((resolve, reject) => {
          socket.connect(address.port!, address.host!, () => resolve());
          socket.once('error', reject);
        });
      } else {
        throw new MuxException('Invalid usbmux address configuration');
      }
    } catch (error: any) {
      socket.destroy();
      if (error.code === 'ECONNREFUSED') {
        throw new ConnectionFailedToUsbmuxdError(
          'Failed to connect to usbmuxd. Ensure iTunes AMDS is running on Windows or usbmuxd on Linux/macOS'
        );
      }
      throw new ConnectionFailedToUsbmuxdError(`Connection failed: ${error.message}`);
    }

    return socket;
  }

  /**
   * Create appropriate MuxConnection instance (Binary or Plist)
   * Follows pymobiledevice3 flow: probe with ReadBUID, close, then open real connection
   */
  // Cache: once probed successfully, always plist — usbmuxd version is stable per process lifetime
  private static probeCache = new Set<string>();

  public static async create(usbmuxAddress?: string): Promise<UsbMuxConnection> {
    const cacheKey = usbmuxAddress ?? '__default__';
    if (!UsbMuxConnection.probeCache.has(cacheKey)) {
      const probeSocket = await UsbMuxConnection.createUsbmuxSocket(usbmuxAddress);
      try {
        const plistXml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>MessageType</key>\n\t<string>ReadBUID</string>\n</dict>\n</plist>\n`;
        const payload = Buffer.from(plistXml, 'utf8');
        const header = Buffer.alloc(12);
        header.writeUInt32LE(UsbMuxVersion.PLIST, 0);
        header.writeUInt32LE(8, 4);
        header.writeUInt32LE(1, 8);
        const packet = Buffer.alloc(16 + payload.length);
        packet.writeUInt32LE(packet.length, 0);
        header.copy(packet, 4);
        payload.copy(packet, 16);
        await new Promise<void>((resolve, reject) => {
          probeSocket.write(packet, (err) => err ? reject(err) : resolve());
        });
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 500);
          probeSocket.once('data', () => { clearTimeout(timer); resolve(); });
          probeSocket.once('error', (e) => { clearTimeout(timer); reject(e); });
        });
      } finally {
        probeSocket.destroy();
      }
      UsbMuxConnection.probeCache.add(cacheKey);
    }

    const socket = await UsbMuxConnection.createUsbmuxSocket(usbmuxAddress);
    const { PlistMuxConnection } = await import('./PlistMuxConnection');
    return new PlistMuxConnection(socket);
  }

  /**
   * Receive exactly N bytes from socket
   */
  protected async recvExactly(size: number): Promise<Buffer> {
    if (!this.socket) throw new MuxException('Socket not connected');
    return readExactly(this.socket, size);
  }

  /**
   * Receive a complete usbmux packet (with length prefix)
   */
  protected async recvPacket(): Promise<Buffer> {
    const lenBuf = await this.recvExactly(4);
    const size = lenBuf.readUInt32LE(0);
    if (size < 16) throw new MuxException(`Invalid usbmux packet size: ${size}`);
    const payload = await this.recvExactly(size - 4);
    return Buffer.concat([lenBuf, payload]);
  }

  /**
   * Check if connection is active
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close connection
   */
  public async close(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket.unref();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   * Assert connection is not in connected state
   */
  protected assertNotConnected(): void {
    if (this.connected) {
      throw new MuxException('Mux is connected, cannot issue control packets');
    }
  }

  /**
   * Raise appropriate exception based on result code
   */
  protected raiseMuxException(result: number, message?: string): void {
    const { BadCommandError, BadDevError, ConnectionFailedError } = require('../exceptions');

    const exceptions: { [key: number]: any } = {
      1: BadCommandError,
      2: BadDevError,
      3: ConnectionFailedError,
      4: ConnectionFailedError,
      6: MuxVersionError,
    };

    const ExceptionClass = exceptions[result] || MuxException;
    throw new ExceptionClass(message || `usbmuxd error: ${result}`);
  }
}
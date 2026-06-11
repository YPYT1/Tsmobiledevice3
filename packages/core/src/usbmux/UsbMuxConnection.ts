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
  private static async createUsbmuxSocket(usbmuxAddress?: string): Promise<net.Socket> {
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
          socket.connect(address.port, address.host!, () => resolve());
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
   */
  public static async create(usbmuxAddress?: string): Promise<UsbMuxConnection> {
    // Probe to determine protocol version
    const probeSocket = await UsbMuxConnection.createUsbmuxSocket(usbmuxAddress);

    try {
      // Send probe message to detect version
      // Implementation will be in PlistMuxConnection
      // For now, we'll default to Plist protocol (modern version)
      probeSocket.destroy();
    } catch (error) {
      probeSocket.destroy();
      throw error;
    }

    // Create new connection
    const socket = await UsbMuxConnection.createUsbmuxSocket(usbmuxAddress);

    // Default to PlistMuxConnection (most common)
    // BinaryMuxConnection will be implemented if needed
    const connection = new (await import('./PlistMuxConnection')).PlistMuxConnection(socket);

    return connection;
  }

  /**
   * Receive exactly N bytes from socket
   */
  protected async recvExactly(size: number): Promise<Buffer> {
    if (!this.socket) {
      throw new MuxException('Socket not connected');
    }

    const chunks: Buffer[] = [];
    let received = 0;

    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new MuxException('Socket receive timeout'));
      }, 10000);

      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        received += chunk.length;

        if (received >= size) {
          clearTimeout(timer);
          this.socket!.removeListener('data', onData);
          this.socket!.removeListener('error', onError);
          this.socket!.removeListener('close', onClose);

          const total = Buffer.concat(chunks);
          resolve(total.subarray(0, size));
        }
      };

      const onError = (error: Error) => {
        clearTimeout(timer);
        this.socket!.removeListener('data', onData);
        this.socket!.removeListener('error', onError);
        this.socket!.removeListener('close', onClose);
        reject(new MuxException(`Socket error: ${error.message}`));
      };

      const onClose = () => {
        clearTimeout(timer);
        this.socket!.removeListener('data', onData);
        this.socket!.removeListener('error', onError);
        this.socket!.removeListener('close', onClose);
        reject(new MuxException('Socket connection closed'));
      };

      this.socket!.on('data', onData);
      this.socket!.once('error', onError);
      this.socket!.once('close', onClose);
    });
  }

  /**
   * Receive a complete usbmux packet (with length prefix)
   */
  protected async recvPacket(): Promise<Buffer> {
    // Read length prefix (4 bytes, little-endian uint32)
    const lengthBuffer = await this.recvExactly(4);
    const size = lengthBuffer.readUInt32LE(0);

    if (size < 4) {
      throw new MuxException(`Invalid usbmux packet size: ${size}`);
    }

    // Read remaining payload
    const payload = await this.recvExactly(size - 4);
    return Buffer.concat([lengthBuffer, payload]);
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
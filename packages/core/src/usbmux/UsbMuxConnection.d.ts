/**
 * Base UsbMux connection - handles socket connection to usbmuxd daemon
 */
import net from 'net';
export interface UsbmuxAddress {
    host?: string;
    port?: number;
    path?: string;
}
export declare abstract class UsbMuxConnection {
    protected socket: net.Socket | null;
    protected connected: boolean;
    protected tag: number;
    protected devices: any[];
    /**
     * Resolve usbmuxd address based on platform
     */
    private static resolveUsbmuxAddress;
    /**
     * Create socket connection to usbmuxd daemon
     */
    static createUsbmuxSocket(usbmuxAddress?: string): Promise<net.Socket>;
    /**
     * Create appropriate MuxConnection instance (Binary or Plist)
     */
    static create(usbmuxAddress?: string): Promise<UsbMuxConnection>;
    /**
     * Receive exactly N bytes from socket
     */
    protected recvExactly(size: number): Promise<Buffer>;
    /**
     * Receive a complete usbmux packet (with length prefix)
     */
    protected recvPacket(): Promise<Buffer>;
    /**
     * Check if connection is active
     */
    isConnected(): boolean;
    /**
     * Close connection
     */
    close(): Promise<void>;
    /**
     * Assert connection is not in connected state
     */
    protected assertNotConnected(): void;
    /**
     * Raise appropriate exception based on result code
     */
    protected raiseMuxException(result: number, message?: string): void;
}
//# sourceMappingURL=UsbMuxConnection.d.ts.map
"use strict";
/**
 * Base UsbMux connection - handles socket connection to usbmuxd daemon
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsbMuxConnection = void 0;
const net_1 = __importDefault(require("net"));
const exceptions_1 = require("../exceptions");
// Windows: iTunes AMDS
const ITUNES_HOST = '127.0.0.1';
const ITUNES_PORT = 27015;
// Linux/macOS: Unix socket
const USBMUXD_PIPE = '/var/run/usbmuxd';
class UsbMuxConnection {
    socket = null;
    connected = false;
    tag = 1;
    devices = [];
    /**
     * Resolve usbmuxd address based on platform
     */
    static resolveUsbmuxAddress(usbmuxAddress) {
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
        }
        else {
            // Linux/macOS: Unix socket
            return { path: USBMUXD_PIPE };
        }
    }
    /**
     * Create socket connection to usbmuxd daemon
     */
    static async createUsbmuxSocket(usbmuxAddress) {
        const address = UsbMuxConnection.resolveUsbmuxAddress(usbmuxAddress);
        const socket = new net_1.default.Socket();
        try {
            if (address.path) {
                // Unix socket connection
                await new Promise((resolve, reject) => {
                    socket.connect(address.path, () => resolve());
                    socket.once('error', reject);
                });
            }
            else if (address.host && address.port) {
                // TCP connection
                await new Promise((resolve, reject) => {
                    socket.connect(address.port, address.host, () => resolve());
                    socket.once('error', reject);
                });
            }
            else {
                throw new exceptions_1.MuxException('Invalid usbmux address configuration');
            }
        }
        catch (error) {
            socket.destroy();
            if (error.code === 'ECONNREFUSED') {
                throw new exceptions_1.ConnectionFailedToUsbmuxdError('Failed to connect to usbmuxd. Ensure iTunes AMDS is running on Windows or usbmuxd on Linux/macOS');
            }
            throw new exceptions_1.ConnectionFailedToUsbmuxdError(`Connection failed: ${error.message}`);
        }
        return socket;
    }
    /**
     * Create appropriate MuxConnection instance (Binary or Plist)
     */
    static async create(usbmuxAddress) {
        // Probe to determine protocol version
        const probeSocket = await UsbMuxConnection.createUsbmuxSocket(usbmuxAddress);
        try {
            // Send probe message to detect version
            // Implementation will be in PlistMuxConnection
            // For now, we'll default to Plist protocol (modern version)
            probeSocket.destroy();
        }
        catch (error) {
            probeSocket.destroy();
            throw error;
        }
        // Create new connection
        const socket = await UsbMuxConnection.createUsbmuxSocket(usbmuxAddress);
        // Default to PlistMuxConnection (most common)
        // BinaryMuxConnection will be implemented if needed
        const connection = new (await Promise.resolve().then(() => __importStar(require('./PlistMuxConnection')))).PlistMuxConnection(socket);
        return connection;
    }
    /**
     * Receive exactly N bytes from socket
     */
    async recvExactly(size) {
        if (!this.socket) {
            throw new exceptions_1.MuxException('Socket not connected');
        }
        const chunks = [];
        let received = 0;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new exceptions_1.MuxException('Socket receive timeout'));
            }, 10000);
            const onData = (chunk) => {
                chunks.push(chunk);
                received += chunk.length;
                if (received >= size) {
                    clearTimeout(timer);
                    this.socket.removeListener('data', onData);
                    this.socket.removeListener('error', onError);
                    this.socket.removeListener('close', onClose);
                    const total = Buffer.concat(chunks);
                    resolve(total.subarray(0, size));
                }
            };
            const onError = (error) => {
                clearTimeout(timer);
                this.socket.removeListener('data', onData);
                this.socket.removeListener('error', onError);
                this.socket.removeListener('close', onClose);
                reject(new exceptions_1.MuxException(`Socket error: ${error.message}`));
            };
            const onClose = () => {
                clearTimeout(timer);
                this.socket.removeListener('data', onData);
                this.socket.removeListener('error', onError);
                this.socket.removeListener('close', onClose);
                reject(new exceptions_1.MuxException('Socket connection closed'));
            };
            this.socket.on('data', onData);
            this.socket.once('error', onError);
            this.socket.once('close', onClose);
        });
    }
    /**
     * Receive a complete usbmux packet (with length prefix)
     */
    async recvPacket() {
        // Read length prefix (4 bytes, little-endian uint32)
        const lengthBuffer = await this.recvExactly(4);
        const size = lengthBuffer.readUInt32LE(0);
        if (size < 4) {
            throw new exceptions_1.MuxException(`Invalid usbmux packet size: ${size}`);
        }
        // Read remaining payload
        const payload = await this.recvExactly(size - 4);
        return Buffer.concat([lengthBuffer, payload]);
    }
    /**
     * Check if connection is active
     */
    isConnected() {
        return this.connected;
    }
    /**
     * Close connection
     */
    async close() {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        this.connected = false;
    }
    /**
     * Assert connection is not in connected state
     */
    assertNotConnected() {
        if (this.connected) {
            throw new exceptions_1.MuxException('Mux is connected, cannot issue control packets');
        }
    }
    /**
     * Raise appropriate exception based on result code
     */
    raiseMuxException(result, message) {
        const { BadCommandError, BadDevError, ConnectionFailedError } = require('../exceptions');
        const exceptions = {
            1: BadCommandError,
            2: BadDevError,
            3: ConnectionFailedError,
            4: ConnectionFailedError,
            6: exceptions_1.MuxVersionError,
        };
        const ExceptionClass = exceptions[result] || exceptions_1.MuxException;
        throw new ExceptionClass(message || `usbmuxd error: ${result}`);
    }
}
exports.UsbMuxConnection = UsbMuxConnection;
//# sourceMappingURL=UsbMuxConnection.js.map
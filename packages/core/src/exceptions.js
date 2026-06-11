"use strict";
/**
 * Custom exceptions for ts-mobiledevice
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AfcError = exports.StartServiceError = exports.InvalidHostIDError = exports.PairingError = exports.LockdownError = exports.NotPairedError = exports.MuxVersionError = exports.BadDevError = exports.BadCommandError = exports.ConnectionFailedToUsbmuxdError = exports.ConnectionFailedError = exports.MuxException = void 0;
class MuxException extends Error {
    constructor(message) {
        super(message);
        this.name = 'MuxException';
    }
}
exports.MuxException = MuxException;
class ConnectionFailedError extends MuxException {
    constructor(message = 'Failed to connect to device') {
        super(message);
        this.name = 'ConnectionFailedError';
    }
}
exports.ConnectionFailedError = ConnectionFailedError;
class ConnectionFailedToUsbmuxdError extends MuxException {
    constructor(message = 'Failed to connect to usbmuxd daemon') {
        super(message);
        this.name = 'ConnectionFailedToUsbmuxdError';
    }
}
exports.ConnectionFailedToUsbmuxdError = ConnectionFailedToUsbmuxdError;
class BadCommandError extends MuxException {
    constructor(message = 'Bad command') {
        super(message);
        this.name = 'BadCommandError';
    }
}
exports.BadCommandError = BadCommandError;
class BadDevError extends MuxException {
    constructor(message = 'Bad device') {
        super(message);
        this.name = 'BadDevError';
    }
}
exports.BadDevError = BadDevError;
class MuxVersionError extends MuxException {
    constructor(message = 'Unsupported usbmuxd version') {
        super(message);
        this.name = 'MuxVersionError';
    }
}
exports.MuxVersionError = MuxVersionError;
class NotPairedError extends MuxException {
    constructor(message = 'Device not paired') {
        super(message);
        this.name = 'NotPairedError';
    }
}
exports.NotPairedError = NotPairedError;
class LockdownError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LockdownError';
    }
}
exports.LockdownError = LockdownError;
class PairingError extends LockdownError {
    constructor(message = 'Pairing failed') {
        super(message);
        this.name = 'PairingError';
    }
}
exports.PairingError = PairingError;
class InvalidHostIDError extends LockdownError {
    constructor(message = 'Invalid host ID') {
        super(message);
        this.name = 'InvalidHostIDError';
    }
}
exports.InvalidHostIDError = InvalidHostIDError;
class StartServiceError extends LockdownError {
    constructor(message = 'Failed to start service') {
        super(message);
        this.name = 'StartServiceError';
    }
}
exports.StartServiceError = StartServiceError;
class AfcError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'AfcError';
        this.code = code;
    }
}
exports.AfcError = AfcError;
//# sourceMappingURL=exceptions.js.map
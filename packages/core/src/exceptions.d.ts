/**
 * Custom exceptions for ts-mobiledevice
 */
export declare class MuxException extends Error {
    constructor(message: string);
}
export declare class ConnectionFailedError extends MuxException {
    constructor(message?: string);
}
export declare class ConnectionFailedToUsbmuxdError extends MuxException {
    constructor(message?: string);
}
export declare class BadCommandError extends MuxException {
    constructor(message?: string);
}
export declare class BadDevError extends MuxException {
    constructor(message?: string);
}
export declare class MuxVersionError extends MuxException {
    constructor(message?: string);
}
export declare class NotPairedError extends MuxException {
    constructor(message?: string);
}
export declare class LockdownError extends Error {
    constructor(message: string);
}
export declare class PairingError extends LockdownError {
    constructor(message?: string);
}
export declare class InvalidHostIDError extends LockdownError {
    constructor(message?: string);
}
export declare class StartServiceError extends LockdownError {
    constructor(message?: string);
}
export declare class AfcError extends Error {
    code: number;
    constructor(code: number, message: string);
}
//# sourceMappingURL=exceptions.d.ts.map
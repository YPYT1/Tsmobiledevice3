/**
 * Custom exceptions for ts-mobiledevice
 */

export class MuxException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MuxException';
  }
}

export class ConnectionFailedError extends MuxException {
  constructor(message: string = 'Failed to connect to device') {
    super(message);
    this.name = 'ConnectionFailedError';
  }
}

export class ConnectionFailedToUsbmuxdError extends MuxException {
  constructor(message: string = 'Failed to connect to usbmuxd daemon') {
    super(message);
    this.name = 'ConnectionFailedToUsbmuxdError';
  }
}

export class BadCommandError extends MuxException {
  constructor(message: string = 'Bad command') {
    super(message);
    this.name = 'BadCommandError';
  }
}

export class BadDevError extends MuxException {
  constructor(message: string = 'Bad device') {
    super(message);
    this.name = 'BadDevError';
  }
}

export class MuxVersionError extends MuxException {
  constructor(message: string = 'Unsupported usbmuxd version') {
    super(message);
    this.name = 'MuxVersionError';
  }
}

export class NotPairedError extends MuxException {
  constructor(message: string = 'Device not paired') {
    super(message);
    this.name = 'NotPairedError';
  }
}

export class LockdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockdownError';
  }
}

export class PairingError extends LockdownError {
  constructor(message: string = 'Pairing failed') {
    super(message);
    this.name = 'PairingError';
  }
}

export class InvalidHostIDError extends LockdownError {
  constructor(message: string = 'Invalid host ID') {
    super(message);
    this.name = 'InvalidHostIDError';
  }
}

export class StartServiceError extends LockdownError {
  constructor(message: string = 'Failed to start service') {
    super(message);
    this.name = 'StartServiceError';
  }
}

export class AfcError extends Error {
  public code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'AfcError';
    this.code = code;
  }
}

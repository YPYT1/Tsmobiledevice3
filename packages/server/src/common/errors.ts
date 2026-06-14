export enum ErrorCode {
  DEVICE_NOT_FOUND     = 'DEVICE_NOT_FOUND',
  SERVICE_UNAVAILABLE  = 'SERVICE_UNAVAILABLE',
  TIMEOUT              = 'TIMEOUT',
  NOT_PAIRED           = 'NOT_PAIRED',
  DVT_UNAVAILABLE      = 'DVT_UNAVAILABLE',
  INVALID_PARAM        = 'INVALID_PARAM',
  INTERNAL             = 'INTERNAL',
}

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus = 500,
  ) {
    super(message);
  }
}

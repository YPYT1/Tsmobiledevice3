import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { AppError } from './errors';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<any>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Internal server error';

    if (exception instanceof AppError) {
      status = exception.httpStatus;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHORIZED' : 'ERROR';
      message = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
      if (message.includes('not found') || message.includes('Device not found')) { status = 404; code = 'DEVICE_NOT_FOUND'; }
      else if (message.includes('timeout') || message.includes('Timeout')) { status = 504; code = 'TIMEOUT'; }
      else if (message.includes('paired') || message.includes('Paired')) { status = 503; code = 'NOT_PAIRED'; }
    }

    if (status >= 500) this.logger.error(message, exception instanceof Error ? exception.stack : '');
    res.status(status).json({ code, message });
  }
}

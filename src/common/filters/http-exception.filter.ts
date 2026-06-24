import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface NestHttpExceptionResponse {
  message: string | string[];
  error: string;
  statusCode: number;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    let message: string | string[] = 'Internal server error';
    let status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;

    if (isHttpException) {
      const res = exception.getResponse();
      status = exception.getStatus();
      if (typeof res === 'object' && res != null) {
        message =
          (res as NestHttpExceptionResponse).message || JSON.stringify(res);
      } else if (typeof res === 'string') {
        message = res;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `status: ${status} | Message: ${JSON.stringify(message)} `,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.error(
        `Status: ${status} | Message: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: message,
      error:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal Server Error'
          : 'Error',
    });
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthenticatedRequest } from '../types/authentication-request';

@Injectable()
export class TenantLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('TrafficLogger');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const { method, url } = request;
    const startTime = Date.now();

    const tenantId = request.user?.tenantId || 'ANONYMOUS';
    const userId = request.user?.userId || 'UNKNOWN';

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(
          `[Tenant: ${tenantId}] [User: ${userId}] ${method} ${url} - Success in ${duration}ms`,
        );
      }),
    );
  }
}

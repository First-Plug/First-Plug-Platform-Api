import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class SuperAdminAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SuperAdminAudit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, query } = request;
    const user = request.user;
    const timestamp = new Date().toISOString();

    // Log de inicio de operación
    this.logger.log(`🔍 [${timestamp}] SuperAdmin Operation Started`, {
      user: {
        id: user?._id,
        email: user?.email,
        role: user?.role,
      },
      request: {
        method,
        url,
        params,
        query,
        bodyKeys: body ? Object.keys(body) : [],
      },
    });

    const startTime = Date.now();

    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;
        
        // Log de operación exitosa
        this.logger.log(`✅ [${timestamp}] SuperAdmin Operation Completed`, {
          user: {
            id: user?._id,
            email: user?.email,
          },
          request: {
            method,
            url,
          },
          response: {
            success: true,
            duration: `${duration}ms`,
            dataCount: Array.isArray(response?.data) ? response.data.length : 
                      response?.totalCount || 
                      (response ? 1 : 0),
          },
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        // Log de error
        this.logger.error(`❌ [${timestamp}] SuperAdmin Operation Failed`, {
          user: {
            id: user?._id,
            email: user?.email,
          },
          request: {
            method,
            url,
            params,
            query,
          },
          error: {
            message: error.message,
            status: error.status,
            duration: `${duration}ms`,
          },
        });

        return throwError(() => error);
      }),
    );
  }
}

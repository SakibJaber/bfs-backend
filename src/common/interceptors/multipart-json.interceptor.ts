import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class MultipartJsonInterceptor implements NestInterceptor {
  constructor(private readonly fields: string[]) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.body && typeof request.body === 'object') {
      for (const field of this.fields) {
        if (typeof request.body[field] === 'string') {
          try {
            request.body[field] = JSON.parse(request.body[field]);
          } catch (e) {
            // Keep as string if not valid JSON
          }
        }
      }
    }

    return next.handle();
  }
}

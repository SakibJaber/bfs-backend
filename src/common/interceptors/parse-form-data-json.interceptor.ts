import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ParseFormDataJsonInterceptor implements NestInterceptor {
  constructor(private readonly field: string) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    if (request.body && typeof request.body[this.field] === 'string') {
      try {
        request.body[this.field] = JSON.parse(request.body[this.field]);
      } catch (err) {
        // If it fails to parse, we leave it as a string.
        // The ValidationPipe will predictably fail with "must be an object"
      }
    }
    return next.handle();
  }
}

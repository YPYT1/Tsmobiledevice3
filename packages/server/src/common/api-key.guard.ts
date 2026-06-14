import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly key = process.env.API_KEY;

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.key) return true; // no key configured → open
    const req = ctx.switchToHttp().getRequest<any>();
    const provided = req.headers['x-api-key'] ?? req.query['api_key'];
    if (provided !== this.key) throw new UnauthorizedException('Invalid API key');
    return true;
  }
}

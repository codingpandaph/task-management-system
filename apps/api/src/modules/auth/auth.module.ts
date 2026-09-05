import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Global,
  Injectable,
  Module,
  Post,
  Req,
  Res,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { AuthRequest, PasswordRestricted, PermissionsGuard, Public, RolesGuard } from '../authorization/authorization';
import { AccountStatusService } from '../employment/account-status.service';
import { AuthService, digest } from './auth.service';

class LoginDto {
  @IsString() @MaxLength(64) employeeId!: string;
  @IsString() @MaxLength(200) password!: string;
}
class ChangePasswordDto {
  @IsString() @MaxLength(200) currentPassword!: string;
  @IsString() @MaxLength(200) password!: string;
}
function cookie(req: AuthRequest, name: string): string {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : '';
}
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (
        req.headers.origin !== this.config.getOrThrow<string>('APP_ORIGIN') ||
        req.headers['x-tms-client'] !== 'web'
      ) {
        throw new ForbiddenException('Untrusted request origin');
      }
    }
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    req.principal = await this.auth.principal(cookie(req, 'tms_access'));
    if (
      req.principal.employee.mustChangePassword &&
      !this.reflector.getAllAndOverride<boolean>('passwordRestricted', [context.getHandler(), context.getClass()])
    ) {
      throw new ForbiddenException('PASSWORD_CHANGE_REQUIRED');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      await this.auth.verifyCsrf(req.principal.sessionId, String(req.headers['x-csrf-token'] ?? ''));
    return true;
  }
}
@Controller('auth')
export class AuthController {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}
  private throttle(key: string, limit: number) {
    const now = Date.now();
    for (const [id, value] of this.attempts) if (value.until < now) this.attempts.delete(id);
    const entry = this.attempts.get(key) ?? { count: 0, until: now + 60_000 };
    entry.count++;
    this.attempts.set(key, entry);
    if (entry.count > limit) throw new HttpException('Too many attempts; try again shortly', 429);
  }
  private setCookies(res: Response, result: { access: string; refresh: string; csrf: string }) {
    const options = {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    res.cookie('tms_access', result.access, { ...options, maxAge: 600_000 });
    res.cookie('tms_refresh', result.refresh, { ...options, maxAge: 7 * 86400_000 });
    res.setHeader('Cache-Control', 'no-store');
    return { csrf: result.csrf };
  }
  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto, @Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    this.throttle(`ip:${req.ip}`, 20);
    this.throttle(`identity:${digest(dto.employeeId.trim().toUpperCase())}`, 5);
    return this.setCookies(res, await this.auth.login(dto.employeeId, dto.password));
  }
  @Post('refresh')
  @Public()
  async refresh(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    this.throttle(`refresh:${req.ip}`, 60);
    return this.setCookies(
      res,
      await this.auth.refresh(cookie(req, 'tms_refresh'), String(req.headers['x-csrf-token'] ?? '')),
    );
  }
  @Get('csrf')
  @Public()
  csrf(@Req() req: AuthRequest) {
    if (req.headers['x-tms-client'] !== 'web') throw new ForbiddenException();
    return this.auth.csrfFor(cookie(req, 'tms_refresh'));
  }
  @Get('me')
  @PasswordRestricted()
  me(@Req() req: AuthRequest) {
    return this.auth.view(req.principal);
  }
  @Post('logout')
  @PasswordRestricted()
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logout(req.principal);
    res.clearCookie('tms_access', { path: '/' });
    res.clearCookie('tms_refresh', { path: '/' });
    return result;
  }
  @Post('change-password')
  @PasswordRestricted()
  async change(@Body() dto: ChangePasswordDto, @Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    return this.setCookies(res, await this.auth.changePassword(req.principal, dto.currentPassword, dto.password));
  }
}
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountStatusService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, AccountStatusService],
})
export class AuthModule {}

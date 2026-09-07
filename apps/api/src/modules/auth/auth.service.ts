import { ForbiddenException, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { effectivePermissions, resolveAccessRole, type CurrentEmployee, type PermissionCode } from '@tms/contracts';
import { audit } from '../audit/audit';
import { DatabaseService, lockEmployee, Transaction } from '../database/database.module';
import { AccountStatusService } from '../employment/account-status.service';
import type { Principal } from '../authorization/authorization';

export const digest = (secret: string) => createHash('sha256').update(secret).digest('hex');
export function validatePassword(password: string) {
  if ([...password].length < 15 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new UnprocessableEntityException('Password must contain at least 15 characters and at most 72 UTF-8 bytes');
  }
}
@Injectable()
export class AuthService {
  private dummyHash: Promise<string>;
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly status: AccountStatusService,
  ) {
    this.dummyHash = bcrypt.hash(randomBytes(24).toString('base64url'), this.rounds);
  }
  get rounds() {
    return this.config.get<number>('BCRYPT_ROUNDS', 12);
  }
  async temporaryPassword() {
    const password = randomBytes(24).toString('base64url');
    return { password, hash: await bcrypt.hash(password, this.rounds) };
  }
  async login(employeeId: string, password: string) {
    const employee = await this.db.employee.findUnique({ where: { employeeId: employeeId.trim().toUpperCase() } });
    const matches = await bcrypt.compare(password, employee?.passwordHash ?? (await this.dummyHash));
    if (!employee || !matches) throw new UnauthorizedException('Invalid credentials or account unavailable');
    const result = await this.db.transaction(async (tx) => {
      if (!(await this.status.eligible(tx, employee.id))) return null;
      const current = await tx.employee.findUniqueOrThrow({ where: { id: employee.id } });
      if (current.passwordHash !== employee.passwordHash) return null;
      return this.issue(tx, employee.id);
    });
    if (!result) throw new UnauthorizedException('Invalid credentials or account unavailable');
    return result;
  }
  async issue(tx: Transaction, employeeId: string) {
    const csrf = randomBytes(32).toString('base64url');
    const session = await tx.session.create({
      data: { employeeId, csrfHash: digest(csrf), expiresAt: new Date(Date.now() + 7 * 86400_000) },
    });
    const refresh = randomBytes(32).toString('base64url');
    await tx.refreshCredential.create({
      data: { sessionId: session.id, digest: digest(refresh), expiresAt: session.expiresAt },
    });
    return { access: await this.sign(employeeId, session.id), refresh, csrf };
  }
  private sign(sub: string, sid: string) {
    return this.jwt.signAsync(
      { sub, sid },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '10m',
        issuer: 'tms-api',
        audience: 'tms-web',
        algorithm: 'HS256',
      },
    );
  }
  async principal(access: string): Promise<Principal> {
    let claims: { sub: string; sid: string };
    try {
      claims = await this.jwt.verifyAsync(access, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        issuer: 'tms-api',
        audience: 'tms-web',
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Session expired');
    }
    if (!claims.sub || !claims.sid) throw new UnauthorizedException();
    const eligible = await this.db.transaction((tx) => this.status.eligible(tx, claims.sub));
    const session = await this.db.session.findFirst({
      where: { id: claims.sid, employeeId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!eligible || !session) throw new UnauthorizedException('Session unavailable');
    const employee = await this.db.employee.findUniqueOrThrow({
      where: { id: claims.sub },
      include: { department: true },
    });
    const grants = await this.db.employeePermission.findMany({
      where: { employeeId: employee.id, revokedAt: null },
      include: { permission: true },
    });
    return {
      employee,
      sessionId: session.id,
      permissions: effectivePermissions(
        employee.position,
        employee.department.kind === 'HR',
        grants.map((g) => g.permission.code as PermissionCode),
      ),
    };
  }
  async csrfFor(refresh: string) {
    const credential = await this.db.refreshCredential.findUnique({
      where: { digest: digest(refresh) },
      include: { session: true },
    });
    if (
      !credential ||
      credential.consumedAt ||
      credential.session.revokedAt ||
      credential.session.expiresAt <= new Date()
    )
      throw new UnauthorizedException();
    const csrf = randomBytes(32).toString('base64url');
    await this.db.session.update({ where: { id: credential.sessionId }, data: { csrfHash: digest(csrf) } });
    return { csrf };
  }
  async verifyCsrf(sessionId: string, csrf: string) {
    const session = await this.db.session.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.csrfHash !== digest(csrf))
      throw new ForbiddenException('Invalid CSRF token');
  }
  async refresh(secret: string, csrf: string) {
    const credential = await this.db.refreshCredential.findUnique({
      where: { digest: digest(secret) },
      include: { session: true },
    });
    if (!credential) throw new UnauthorizedException();
    const result = await this.db.transaction(async (tx) => {
      const eligible = await this.status.eligible(tx, credential.session.employeeId);
      const current = await tx.refreshCredential.findUniqueOrThrow({
        where: { id: credential.id },
        include: { session: true },
      });
      if (!eligible || current.session.revokedAt || current.session.expiresAt <= new Date()) return null;
      if (current.consumedAt) {
        await tx.session.update({
          where: { id: current.sessionId },
          data: { revokedAt: new Date(), revokeReason: 'REFRESH_REPLAY' },
        });
        return null;
      }
      if (current.session.csrfHash !== digest(csrf)) throw new ForbiddenException('Invalid CSRF token');
      await tx.refreshCredential.update({ where: { id: current.id }, data: { consumedAt: new Date() } });
      const refresh = randomBytes(32).toString('base64url');
      await tx.refreshCredential.create({
        data: { sessionId: current.sessionId, digest: digest(refresh), expiresAt: current.session.expiresAt },
      });
      return { access: await this.sign(current.session.employeeId, current.sessionId), refresh, csrf };
    });
    if (!result) throw new UnauthorizedException('Session unavailable');
    return result;
  }
  async logout(actor: Principal) {
    await this.db.session.update({
      where: { id: actor.sessionId },
      data: { revokedAt: new Date(), revokeReason: 'LOGOUT' },
    });
    return { ok: true };
  }
  async changePassword(actor: Principal, currentPassword: string, password: string) {
    validatePassword(password);
    if (!(await bcrypt.compare(currentPassword, actor.employee.passwordHash)))
      throw new UnauthorizedException('Current password is incorrect');
    if (await bcrypt.compare(password, actor.employee.passwordHash))
      throw new UnprocessableEntityException('Choose a different password');
    const hash = await bcrypt.hash(password, this.rounds);
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, actor.employee.id);
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: actor.employee.id } });
      if (employee.passwordHash !== actor.employee.passwordHash) throw new UnauthorizedException();
      await tx.employee.update({ where: { id: employee.id }, data: { passwordHash: hash, mustChangePassword: false } });
      await tx.session.updateMany({
        where: { employeeId: employee.id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'PASSWORD_CHANGE' },
      });
      await audit(tx, employee.id, 'PASSWORD_CHANGED', 'Employee', employee.id);
      return this.issue(tx, employee.id);
    });
  }
  view(actor: Principal): CurrentEmployee {
    const e = actor.employee;
    return {
      id: e.id,
      employeeId: e.employeeId,
      displayName: [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' '),
      department: { id: e.departmentId, code: e.department.code, name: e.department.name },
      position: e.position,
      role: resolveAccessRole(e.position, e.department.kind === 'HR'),
      mustChangePassword: e.mustChangePassword,
      permissions: e.mustChangePassword ? [] : actor.permissions,
    };
  }
}

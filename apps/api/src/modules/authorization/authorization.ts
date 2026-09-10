import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PermissionCode, Position } from '@tms/contracts';
import type { Request } from 'express';
import type { Department, Employee, Team } from '../../generated/prisma/client';

export interface Principal {
  employee: Employee & { department: Department | null; team: Team | null };
  permissions: PermissionCode[];
  sessionId: string;
}
export type AuthRequest = Request & { principal: Principal };
export const Public = () => SetMetadata('public', true);
export const PasswordRestricted = () => SetMetadata('passwordRestricted', true);
export const RequirePermissions = (...permissions: PermissionCode[]) => SetMetadata('permissions', permissions);
export const RequireRoles = (...roles: Position[]) => SetMetadata('roles', roles);
export function requirePermission(actor: Principal, permission: PermissionCode) {
  if (!actor.permissions.includes(permission)) throw new ForbiddenException('You do not have access to do that');
}
export function requireHr(actor: Principal, permission: PermissionCode) {
  requirePermission(actor, permission);
  if (actor.employee.position !== 'MANAGING_DIRECTOR' && actor.employee.department?.kind !== 'HR') {
    throw new ForbiddenException('This action is limited to authorized HR employees');
  }
}
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const required =
      this.reflector.getAllAndOverride<PermissionCode[]>('permissions', [context.getHandler(), context.getClass()]) ??
      [];
    const actor = context.switchToHttp().getRequest<AuthRequest>().principal;
    for (const permission of required) requirePermission(actor, permission);
    return true;
  }
}
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Position[]>('roles', [context.getHandler(), context.getClass()]);
    if (roles && !roles.includes(context.switchToHttp().getRequest<AuthRequest>().principal.employee.position)) {
      throw new ForbiddenException('Your role does not include this action');
    }
    return true;
  }
}

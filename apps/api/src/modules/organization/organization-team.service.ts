import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Employee } from '../../generated/prisma/client';
import { audit } from '../audit/audit';
import { type Principal, requireHr } from '../authorization/authorization';
import type { Transaction } from '../database/database.module';
import { type EditTeamDto, type TeamDto } from './dto';
import { OrganizationEmployeeService } from './organization-employee.service';

export abstract class OrganizationTeamService extends OrganizationEmployeeService {
  protected canManageDepartment(actor: Principal, departmentId: string) {
    return (
      actor.employee.position === 'MANAGING_DIRECTOR' ||
      (actor.employee.position === 'SENIOR_DIRECTOR' && actor.employee.departmentId === departmentId)
    );
  }

  async createTeam(actor: Principal, departmentId: string, dto: TeamDto) {
    if (!this.canManageDepartment(actor, departmentId)) requireHr(actor, 'DEPARTMENT_UPDATE');
    const department = await this.db.department.findFirst({ where: { id: departmentId, status: 'ACTIVE' } });
    if (!department) throw new ConflictException('Active department required');
    return this.db.transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          departmentId,
          code: dto.code,
          name: dto.name,
          taskManagementTypes: dto.taskManagementTypes ?? department.taskManagementTypes,
          kanbanWipLimit: dto.kanbanWipLimit ?? department.kanbanWipLimit,
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          departmentId,
          teamId: team.id,
          code: `${department.code}-${team.code}`,
          name: `${team.name} workspace`,
          function:
            department.kind === 'HR'
              ? 'HR_OPERATIONS'
              : department.code === 'MKT'
                ? 'MARKETING_CREATIVE'
                : 'SALES_ACCOUNT_MANAGEMENT',
        },
      });
      await audit(tx, actor.employee.id, 'TEAM_CREATED', 'Team', team.id, { departmentId });
      return { ...team, workspace };
    });
  }

  async editTeam(actor: Principal, id: string, dto: EditTeamDto) {
    const team = await this.db.team.findUniqueOrThrow({ where: { id } });
    const managesOwnTeam = actor.employee.position === 'ACCOUNT_DIRECTOR' && actor.employee.teamId === team.id;
    if (!this.canManageDepartment(actor, team.departmentId) && !managesOwnTeam) requireHr(actor, 'DEPARTMENT_UPDATE');
    const updated = await this.db.team.updateMany({
      where: { id, version: dto.version },
      data: {
        code: dto.code,
        name: dto.name,
        taskManagementTypes: dto.taskManagementTypes,
        kanbanWipLimit: dto.kanbanWipLimit,
        version: { increment: 1 },
      },
    });
    if (!updated.count) throw new ConflictException('Team changed; reload before saving');
    return { ok: true };
  }

  async teamStatus(actor: Principal, id: string, active: boolean) {
    const team = await this.db.team.findUniqueOrThrow({ where: { id } });
    if (!this.canManageDepartment(actor, team.departmentId)) requireHr(actor, 'DEPARTMENT_UPDATE');
    if (!active) {
      const people = await this.db.employee.count({ where: { teamId: id, status: { in: ['ACTIVE', 'SUSPENDED'] } } });
      if (people) throw new ConflictException('Move active team members before deactivation');
    }
    return this.db.team.update({
      where: { id },
      data: { status: active ? 'ACTIVE' : 'INACTIVE', version: { increment: 1 } },
    });
  }
  protected async history(tx: Transaction, employee: Employee, actor: Principal, reason: string) {
    await tx.employeeOrganizationHistory.updateMany({
      where: { employeeId: employee.id, effectiveTo: null },
      data: { effectiveTo: new Date() },
    });
    await tx.employeeOrganizationHistory.create({
      data: {
        employeeId: employee.id,
        departmentId: employee.departmentId,
        teamId: employee.teamId,
        position: employee.position,
        actorId: actor.employee.id,
        reason,
      },
    });
  }
  async teamDirector(actor: Principal, teamId: string, employeeId: string, reason: string) {
    const team = await this.db.team.findUniqueOrThrow({ where: { id: teamId } });
    if (!this.canManageDepartment(actor, team.departmentId)) requireHr(actor, 'DEPARTMENT_ASSIGN_ACCOUNT_DIRECTOR');
    if (employeeId === actor.employee.id) throw new ForbiddenException('Self assignment is prohibited');
    return this.db.transaction(async (tx) => {
      const employee = await tx.employee.findUniqueOrThrow({ where: { id: employeeId } });
      if (
        employee.departmentId !== team.departmentId ||
        employee.teamId !== teamId ||
        employee.position !== 'MEMBER' ||
        !(await this.accounts.eligible(tx, employee.id))
      )
        throw new ConflictException('Eligible member of the target team required');
      const previous = await tx.employee.findMany({
        where: { teamId, position: 'ACCOUNT_DIRECTOR', id: { not: employeeId } },
      });
      for (const old of previous) {
        const demoted = await tx.employee.update({
          where: { id: old.id },
          data: { position: 'MEMBER', version: { increment: 1 } },
        });
        await this.history(tx, demoted, actor, reason);
      }
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { position: 'ACCOUNT_DIRECTOR', version: { increment: 1 } },
      });
      await this.history(tx, updated, actor, reason);
      await audit(tx, actor.employee.id, 'TEAM_DIRECTOR_ASSIGNED', 'Team', teamId, { employeeId });
      return { ok: true };
    });
  }
}

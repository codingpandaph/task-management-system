import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { IsIn, IsInt, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { today } from '../../common/dates';
import { AuthRequest, requireHr } from '../authorization/authorization';
import { audit } from '../audit/audit';
import { DatabaseService, lockEmployee } from '../database/database.module';
class PolicyDto {
  @IsString() @MinLength(2) name!: string;
  @IsInt() @Min(0) @Max(366) vacationDays!: number;
  @IsInt() @Min(0) @Max(366) sickDays!: number;
}
class ChristmasDto {
  @IsString() @MinLength(2) name!: string;
  @IsInt() @Min(0) @Max(31) days!: number;
}
class AssignDto {
  @IsUUID() policyVersionId!: string;
  @IsInt() @Min(2020) @Max(2200) year!: number;
}
class StatusDto {
  @IsIn(['ACTIVE', 'INACTIVE']) status!: 'ACTIVE' | 'INACTIVE';
}
@Injectable()
export class PoliciesService {
  constructor(private readonly db: DatabaseService) {}
  async list() {
    return {
      leave: await this.db.leavePolicy.findMany({
        include: { leavePolicyVersion_policy: { orderBy: { number: 'desc' } } },
      }),
      christmas: await this.db.christmasPolicy.findMany({
        include: { christmasPolicyVersion_policy: { orderBy: { number: 'desc' } } },
      }),
    };
  }
  async save(actor: AuthRequest['principal'], dto: PolicyDto | ChristmasDto, christmas: boolean, id?: string) {
    requireHr(actor, christmas ? 'CHRISTMAS_POLICY_MANAGE' : 'LEAVE_POLICY_MANAGE');
    return this.db.transaction(async (tx) => {
      if (christmas) {
        const d = dto as ChristmasDto;
        const p = id
          ? await tx.christmasPolicy.update({ where: { id }, data: { name: d.name, version: { increment: 1 } } })
          : await tx.christmasPolicy.create({ data: { name: d.name } });
        const v = await tx.christmasPolicyVersion.create({
          data: { policyId: p.id, number: p.version, days: d.days, actorId: actor.employee.id },
        });
        await audit(tx, actor.employee.id, 'CHRISTMAS_POLICY_VERSIONED', 'ChristmasPolicy', p.id);
        return v;
      }
      const d = dto as PolicyDto;
      const p = id
        ? await tx.leavePolicy.update({ where: { id }, data: { name: d.name, version: { increment: 1 } } })
        : await tx.leavePolicy.create({ data: { name: d.name } });
      const v = await tx.leavePolicyVersion.create({
        data: {
          policyId: p.id,
          number: p.version,
          vacationDays: d.vacationDays,
          sickDays: d.sickDays,
          actorId: actor.employee.id,
        },
      });
      await audit(tx, actor.employee.id, 'LEAVE_POLICY_VERSIONED', 'LeavePolicy', p.id);
      return v;
    });
  }
  async assign(actor: AuthRequest['principal'], employeeId: string, dto: AssignDto, christmas: boolean) {
    requireHr(actor, christmas ? 'CHRISTMAS_POLICY_MANAGE' : 'LEAVE_POLICY_MANAGE');
    if (employeeId === actor.employee.id) throw new ConflictException('Self policy changes prohibited');
    return this.db.transaction(async (tx) => {
      await lockEmployee(tx, employeeId);
      if (dto.year <= Number(today().slice(0, 4)))
        throw new ConflictException('Reassignment applies next year; use an audited adjustment for this year');
      const where = { employeeId_year: { employeeId, year: dto.year } };
      if (christmas) {
        const version = await tx.christmasPolicyVersion.findUniqueOrThrow({
          where: { id: dto.policyVersionId },
          include: { policy: true },
        });
        if (version.policy.status !== 'ACTIVE') throw new ConflictException('Active policy required');
        await tx.employeeChristmasPolicyAssignment.upsert({
          where,
          create: { employeeId, year: dto.year, policyVersionId: version.id, actorId: actor.employee.id },
          update: { policyVersionId: version.id, actorId: actor.employee.id },
        });
      } else {
        const version = await tx.leavePolicyVersion.findUniqueOrThrow({
          where: { id: dto.policyVersionId },
          include: { policy: true },
        });
        if (version.policy.status !== 'ACTIVE') throw new ConflictException('Active policy required');
        await tx.employeeLeavePolicyAssignment.upsert({
          where,
          create: { employeeId, year: dto.year, policyVersionId: version.id, actorId: actor.employee.id },
          update: { policyVersionId: version.id, actorId: actor.employee.id },
        });
      }
      await audit(tx, actor.employee.id, 'POLICY_ASSIGNED', 'Employee', employeeId, { year: dto.year, christmas });
      return { ok: true };
    });
  }
  async status(actor: AuthRequest['principal'], id: string, status: 'ACTIVE' | 'INACTIVE', christmas: boolean) {
    requireHr(actor, christmas ? 'CHRISTMAS_POLICY_MANAGE' : 'LEAVE_POLICY_MANAGE');
    return this.db.transaction(async (tx) => {
      const p = christmas
        ? await tx.christmasPolicy.update({ where: { id }, data: { status } })
        : await tx.leavePolicy.update({ where: { id }, data: { status } });
      await audit(tx, actor.employee.id, 'POLICY_STATUS_CHANGED', christmas ? 'ChristmasPolicy' : 'LeavePolicy', id, {
        status,
      });
      return p;
    });
  }
}
@Controller()
class PoliciesController {
  constructor(private readonly service: PoliciesService) {}
  @Get('policies') list() {
    return this.service.list();
  }
  @Post('leave-policies') create(@Req() r: AuthRequest, @Body() d: PolicyDto) {
    return this.service.save(r.principal, d, false);
  }
  @Post('leave-policies/:id/versions') version(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PolicyDto,
  ) {
    return this.service.save(r.principal, d, false, id);
  }
  @Post('christmas-policies') christmas(@Req() r: AuthRequest, @Body() d: ChristmasDto) {
    return this.service.save(r.principal, d, true);
  }
  @Post('christmas-policies/:id/versions') christmasVersion(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ChristmasDto,
  ) {
    return this.service.save(r.principal, d, true, id);
  }
  @Post('employees/:id/leave-policy') assign(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AssignDto,
  ) {
    return this.service.assign(r.principal, id, d, false);
  }
  @Post('employees/:id/christmas-policy') assignChristmas(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AssignDto,
  ) {
    return this.service.assign(r.principal, id, d, true);
  }
  @Post('leave-policies/:id/status') status(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: StatusDto,
  ) {
    return this.service.status(r.principal, id, d.status, false);
  }
  @Post('christmas-policies/:id/status') christmasStatus(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: StatusDto,
  ) {
    return this.service.status(r.principal, id, d.status, true);
  }
}
@Module({ providers: [PoliciesService], controllers: [PoliciesController] })
export class LeavePoliciesModule {}

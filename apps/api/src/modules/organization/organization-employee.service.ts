import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { dateOnly, today } from '../../common/dates';
import { audit } from '../audit/audit';
import { Principal, requireHr } from '../authorization/authorization';
import { EmployeeDto, EditEmployeeDto, PageDto } from './dto';
import { directory, OrganizationBaseService } from './organization-base.service';

export abstract class OrganizationEmployeeService extends OrganizationBaseService {
  async employees(actor: Principal, q: PageDto, hr = false) {
    if (hr && actor.employee.position !== 'SENIOR_DIRECTOR') requireHr(actor, 'EMPLOYEE_READ');
    const organizationWide =
      actor.employee.position === 'MANAGING_DIRECTOR' ||
      (actor.employee.department?.kind === 'HR' && actor.permissions.includes('EMPLOYEE_READ'));
    const visibility: Prisma.EmployeeWhereInput = organizationWide
      ? {}
      : actor.employee.position === 'SENIOR_DIRECTOR'
        ? { departmentId: actor.employee.departmentId }
        : { teamId: actor.employee.teamId ?? '00000000-0000-0000-0000-000000000000' };
    const where: Prisma.EmployeeWhereInput = {
      ...visibility,
      ...(hr ? { status: q.status } : { status: 'ACTIVE' }),
      ...(organizationWide && q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.teamId ? { teamId: q.teamId } : {}),
      position: q.position,
      ...(q.employmentType && hr
        ? { employmentRecord_employee: { some: { type: q.employmentType, effectiveTo: null } } }
        : {}),
      ...(q.search
        ? {
            AND: q.search
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map((term) => ({
                OR: ['employeeId', 'firstName', 'middleName', 'lastName'].map((field) => ({
                  [field]: { contains: term, mode: 'insensitive' },
                })),
              })),
          }
        : {}),
    };
    const direction = q.sortDirection;
    const order: Prisma.EmployeeOrderByWithRelationInput[] =
      q.sortBy === 'department'
        ? [{ department: { name: direction } }]
        : q.sortBy === 'team'
          ? [{ team: { name: direction } }]
          : q.sortBy === 'position'
            ? [{ position: direction }]
            : q.sortBy === 'employeeId'
              ? [{ employeeId: direction }]
              : q.sortBy === 'name'
                ? [{ firstName: direction }, { middleName: direction }, { lastName: direction }]
                : [{ lastName: 'asc' }];
    const rows = await this.db.employee.findMany({
      where,
      include: { department: true, team: true },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      orderBy: [...order, { id: 'asc' }],
    });
    const total = await this.db.employee.count({ where });
    return {
      items: rows.map((e) => ({ ...directory(e), ...(hr ? { status: e.status, version: e.version } : {}) })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  async detail(actor: Principal, id: string) {
    if (actor.employee.position !== 'SENIOR_DIRECTOR') requireHr(actor, 'EMPLOYEE_READ');
    const e = await this.db.employee.findUnique({ where: { id }, include: { department: true, team: true } });
    if (!e) throw new NotFoundException();
    const organizationWide =
      actor.employee.position === 'MANAGING_DIRECTOR' ||
      (actor.employee.department?.kind === 'HR' && actor.permissions.includes('EMPLOYEE_READ'));
    if (
      !organizationWide &&
      (actor.employee.position !== 'SENIOR_DIRECTOR' || actor.employee.departmentId !== e.departmentId)
    )
      throw new NotFoundException();
    return {
      ...directory(e),
      firstName: e.firstName,
      middleName: e.middleName,
      lastName: e.lastName,
      status: e.status,
      version: e.version,
      ...(actor.permissions.includes('EMPLOYEE_PRIVATE_READ')
        ? { birthDate: e.birthDate.toISOString().slice(0, 10), email: e.email }
        : {}),
    };
  }
  async create(actor: Principal, dto: EmployeeDto) {
    requireHr(actor, 'EMPLOYEE_CREATE');
    const birth = dateOnly(dto.birthDate);
    if (dto.birthDate >= today()) throw new UnprocessableEntityException('Birth date must be in the past');
    const employment = this.employmentData({ ...dto, type: dto.employmentType, reason: 'Employee created' });
    const credentials = await this.auth.temporaryPassword();
    const result = await this.db.transaction(async (tx) => {
      const department = await tx.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || department.status !== 'ACTIVE')
        throw new UnprocessableEntityException('Active department required');
      const team = await tx.team.findFirst({
        where: { id: dto.teamId, departmentId: department.id, status: 'ACTIVE' },
      });
      if (!team) throw new UnprocessableEntityException('Active team in the selected department required');
      const policy = await tx.leavePolicyVersion.findUnique({
        where: { id: dto.leavePolicyVersionId },
        include: { policy: true },
      });
      const christmas = await tx.christmasPolicyVersion.findUnique({
        where: { id: dto.christmasPolicyVersionId },
        include: { policy: true },
      });
      if (!policy || !christmas || policy.policy.status !== 'ACTIVE' || christmas.policy.status !== 'ACTIVE')
        throw new UnprocessableEntityException('Active policies required');
      const [sequence] = await tx.$queryRaw<{ value: bigint }[]>`SELECT nextval('employee_id_sequence') AS value`;
      const year = Number(today().slice(0, 4));
      const employeeId = `${year}-${department.code}-${String(sequence.value).padStart(6, '0')}`;
      const e = await tx.employee.create({
        data: {
          employeeId,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          birthDate: birth,
          email: dto.email,
          departmentId: department.id,
          teamId: team.id,
          passwordHash: credentials.hash,
        },
        include: { department: true, team: true },
      });
      await tx.employmentRecord.create({
        data: { ...employment, employeeId: e.id, actorId: actor.employee.id, reason: 'Employee created' },
      });
      await tx.employeeOrganizationHistory.create({
        data: {
          employeeId: e.id,
          departmentId: department.id,
          teamId: team.id,
          position: 'MEMBER',
          actorId: actor.employee.id,
          reason: 'Employee created',
        },
      });
      await tx.employeeLeavePolicyAssignment.create({
        data: { employeeId: e.id, year, policyVersionId: policy.id, actorId: actor.employee.id },
      });
      await tx.employeeChristmasPolicyAssignment.create({
        data: { employeeId: e.id, year, policyVersionId: christmas.id, actorId: actor.employee.id },
      });
      await audit(tx, actor.employee.id, 'EMPLOYEE_CREATED', 'Employee', e.id, {
        departmentId: department.id,
        teamId: team.id,
      });
      return directory(e);
    });
    return { ...result, temporaryPassword: credentials.password };
  }
  async edit(actor: Principal, id: string, dto: EditEmployeeDto) {
    requireHr(actor, 'EMPLOYEE_UPDATE');
    return this.db.transaction(async (tx) => {
      const updated = await tx.employee.updateMany({
        where: { id, version: dto.version },
        data: {
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          email: dto.email,
          version: { increment: 1 },
        },
      });
      if (!updated.count) throw new ConflictException('Employee changed; reload before saving');
      await audit(tx, actor.employee.id, 'EMPLOYEE_UPDATED', 'Employee', id, {
        fields: ['firstName', 'middleName', 'lastName', 'email'],
      });
      return { ok: true };
    });
  }
}

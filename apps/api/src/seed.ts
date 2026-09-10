import 'reflect-metadata';
/* eslint-disable max-lines -- the fictional seed remains in transaction order for auditability */
import * as bcrypt from 'bcrypt';
import { HR_DELEGABLE, PERMISSIONS } from '@tms/contracts';
import { dateOnly, today } from './common/dates';
import { DatabaseService } from './modules/database/database.module';
import { LeaveBalanceService } from './modules/leave/balance.service';
import { seedBoardColumns, seedHolidayEvents, seedPeople, seedTeams } from './seed-data';
import { seedApprovalNotification } from './seed-notification';
export async function seed(db: DatabaseService) {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true')
    throw new Error('Seeding requires non-production mode and ALLOW_DEMO_SEED=true');
  if (await db.employee.count()) return;
  const limited = process.env.E2E_SEED === 'true',
    passwordHash = await bcrypt.hash('Demo only password 2026!', 12),
    year = Number(today().slice(0, 4));
  const events = await seedHolidayEvents();
  const years = events.map((e) => Number(e.date.slice(0, 4)));
  await db.transaction(async (tx) => {
    const calendar = await tx.workingCalendar.create({
      data: {
        code: 'UK-EW',
        name: 'England & Wales',
        coverageStart: dateOnly(`${Math.min(...years)}-01-01`),
        coverageEnd: dateOnly(`${Math.max(...years)}-12-31`),
      },
    });
    await tx.calendarWorkingDay.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({ calendarId: calendar.id, weekday })),
    });
    await tx.holiday.createMany({
      data: events.map((e) => ({ calendarId: calendar.id, date: dateOnly(e.date), name: e.title })),
    });
    for (const code of PERMISSIONS)
      await tx.permission.create({
        data: { code, description: code.toLowerCase().replaceAll('_', ' '), delegable: HR_DELEGABLE.includes(code) },
      });
    const regular = await tx.leavePolicy.create({ data: { name: 'Regular' } });
    const policy = await tx.leavePolicyVersion.create({
      data: { policyId: regular.id, number: 1, vacationDays: 25, sickDays: 5 },
    });
    if (!limited) {
      const custom = await tx.leavePolicy.create({ data: { name: 'Extended' } });
      await tx.leavePolicyVersion.create({ data: { policyId: custom.id, number: 1, vacationDays: 30, sickDays: 8 } });
    }
    const christmas = await tx.christmasPolicy.create({ data: { name: 'Regular Christmas Vacation' } });
    const christmasVersion = await tx.christmasPolicyVersion.create({
      data: { policyId: christmas.id, number: 1, days: 5 },
    });
    if (!limited) {
      const extended = await tx.christmasPolicy.create({ data: { name: 'Extended Christmas Vacation' } });
      await tx.christmasPolicyVersion.create({ data: { policyId: extended.id, number: 1, days: 7 } });
    }
    const departments = new Map<string, string>();
    for (const [code, name] of [
      ['ACC', 'Client Services'],
      ['MKT', 'Marketing'],
      ['HR', 'Human Resources'],
    ]) {
      const d = await tx.department.create({
        data: {
          code,
          name,
          kind: code === 'HR' ? 'HR' : 'OPERATIONAL',
          taskManagementTypes: code === 'HR' ? ['LIST'] : ['KANBAN', 'SCRUM'],
          kanbanWipLimit: 2,
        },
      });
      departments.set(code, d.id);
    }
    const teams = new Map<string, string>();
    for (const definition of seedTeams) {
      const code = definition.departmentCode;
      const team = await tx.team.create({
        data: {
          code: definition.code,
          name: definition.name,
          departmentId: departments.get(code)!,
          taskManagementTypes: code === 'HR' ? ['LIST'] : ['KANBAN', 'SCRUM'],
          kanbanWipLimit: 2,
        },
      });
      teams.set(`${code}:${definition.code}`, team.id);
    }
    const people = seedPeople(limited);
    const ids: string[] = [];
    for (const [i, person] of people.entries()) {
      const { firstName, lastName, departmentCode: code, teamCode, position } = person;
      const [sequence] = await tx.$queryRaw<{ value: bigint }[]>`SELECT nextval('employee_id_sequence') AS value`;
      const status = i === 8 ? 'SUSPENDED' : i === 9 ? 'INACTIVE' : 'ACTIVE';
      const employee = await tx.employee.create({
        data: {
          employeeId: `${year}-${code ?? 'ORG'}-${String(sequence.value).padStart(6, '0')}`,
          firstName,
          lastName,
          birthDate: dateOnly('1990-06-15'),
          departmentId: code ? departments.get(code)! : null,
          teamId: code && teamCode ? teams.get(`${code}:${teamCode}`)! : null,
          position,
          status,
          passwordHash,
          mustChangePassword: i === 10,
        },
      });
      ids.push(employee.id);
      await tx.employeeOrganizationHistory.create({
        data: {
          employeeId: employee.id,
          departmentId: employee.departmentId,
          teamId: employee.teamId,
          position,
          reason: 'Fictional development seed',
        },
      });
      await tx.employmentRecord.create({
        data: {
          employeeId: employee.id,
          type: i === 7 ? 'PROBATIONARY' : i === 6 || i === 9 ? 'CONTRACTUAL' : 'FULL_TIME',
          startDate: dateOnly(`${year}-01-01`),
          endDate: i === 6 ? dateOnly(`${year}-12-31`) : i === 9 ? dateOnly(`${year}-01-31`) : null,
          probationEnd: i === 7 ? dateOnly(`${year}-11-01`) : null,
          reason: 'Fictional development seed',
        },
      });
      if (i === 8)
        await tx.suspension.create({
          data: {
            employeeId: employee.id,
            previousAccessState: 'ACTIVE',
            suspendedUntil: new Date(Date.now() + 7 * 86400_000),
            reason: 'Fictional demonstration suspension',
          },
        });
      await tx.employeeLeavePolicyAssignment.create({
        data: { employeeId: employee.id, year, policyVersionId: policy.id },
      });
      await tx.employeeChristmasPolicyAssignment.create({
        data: { employeeId: employee.id, year, policyVersionId: christmasVersion.id },
      });
      const grants = i === 0 || i === 3 ? PERMISSIONS : i === 4 ? (['LEAVE_HR_APPROVE'] as const) : [];
      for (const code of grants) {
        const permission = await tx.permission.findUniqueOrThrow({ where: { code } });
        await tx.employeePermission.create({ data: { employeeId: employee.id, permissionId: permission.id } });
      }
    }
    await tx.organizationSettings.create({
      data: { name: 'CPSync', calendarId: calendar.id, hrApproverId: ids[4] },
    });
    for (const definition of seedTeams) {
      const code = definition.departmentCode;
      const teamId = teams.get(`${code}:${definition.code}`)!;
      const functionName =
        code === 'ACC' ? 'SALES_ACCOUNT_MANAGEMENT' : code === 'MKT' ? 'MARKETING_CREATIVE' : 'HR_OPERATIONS';
      const primaryTeam = seedTeams.find((team) => team.departmentCode === code)?.code === definition.code;
      const workspaceCode = primaryTeam ? code : `${code}-${definition.code}`;
      const teamPeople = await tx.employee.findMany({
        where: { teamId, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      const director = teamPeople.find((employee) => employee.position === 'ACCOUNT_DIRECTOR');
      if (!director) throw new Error(`Seed team ${definition.code} requires an Account Director`);
      const workspace = await tx.workspace.create({
        data: {
          code: workspaceCode,
          name: `${definition.name} workspace`,
          function: functionName,
          departmentId: departments.get(code)!,
          teamId,
          nextTaskNumber: 3,
        },
      });
      const board = await tx.taskBoard.create({
        data: {
          workspaceId: workspace.id,
          name: `${definition.name} delivery`,
          kind: code === 'HR' ? 'LIST' : 'KANBAN',
          creatorId: director.id,
          columns: { create: seedBoardColumns(code) },
        },
        include: { columns: true },
      });
      await tx.workspaceMembership.createMany({
        data: teamPeople.map(({ id, position }) => ({
          workspaceId: workspace.id,
          employeeId: id,
          canCreateTasks: position === 'ACCOUNT_DIRECTOR' || id === ids[6] || id === ids[7],
          canCreateBoards: position === 'ACCOUNT_DIRECTOR' || id === ids[6] || id === ids[7],
        })),
      });
      const initial = board.columns.find((column) => column.isInitial)!;
      const progress = board.columns.find((column) => column.semantic === 'IN_PROGRESS') ?? initial;
      const reporterId = director.id;
      const assigneeId = teamPeople.find((employee) => employee.position === 'MEMBER')?.id ?? director.id;
      for (const [index, task] of (
        [
          ['Prepare weekly client update', 'HIGH', 8, progress.id],
          ['Review upcoming priorities', 'MEDIUM', 4, initial.id],
        ] as const
      ).entries()) {
        const created = await tx.task.create({
          data: {
            workspaceId: workspace.id,
            boardId: board.id,
            columnId: task[3],
            number: index + 1,
            publicKey: `${workspaceCode}-#${index + 1}`,
            title: task[0],
            description: 'Fictional task-management demonstration item.',
            priority: task[1],
            estimatedHours: task[2],
            reporterId,
            assigneeId,
          },
        });
        await tx.taskActivityLog.create({
          data: { taskId: created.id, actorEmployeeId: reporterId, actionType: 'CREATE' },
        });
      }
    }
    const balances = new LeaveBalanceService();
    for (const id of ids) await balances.accounts(tx, id, year);
    for (const [i, status] of (limited ? [] : (['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const)).entries()) {
      const employeeId = ids[6];
      const accounts = await balances.accounts(tx, employeeId, year);
      const account = accounts.find((a) => a.type === 'VACATION')!;
      const date = dateOnly(`${year}-11-${String(2 + i).padStart(2, '0')}`);
      const r = await tx.leaveRequest.create({
        data: {
          employeeId,
          accountId: account.id,
          type: 'VACATION',
          startDate: date,
          endDate: date,
          status,
          submittedAt: new Date(),
          submittedById: employeeId,
          reason: 'Fictional demonstration',
        },
      });
      await tx.leaveRequestDay.create({ data: { requestId: r.id, date } });
      await tx.leaveApprovalStep.createMany({
        data: [
          {
            requestId: r.id,
            sequence: 1,
            type: 'ACCOUNT_DIRECTOR',
            approverId: ids[1],
            departmentId: departments.get('ACC')!,
            teamId: teams.get('ACC:CLIENT-A')!,
            status:
              status === 'PENDING'
                ? 'PENDING'
                : status === 'REJECTED'
                  ? 'REJECTED'
                  : status === 'CANCELLED'
                    ? 'CANCELLED'
                    : 'APPROVED',
            reason: status === 'REJECTED' ? 'Fictional scheduling conflict' : null,
          },
          {
            requestId: r.id,
            sequence: 2,
            type: 'SENIOR_DIRECTOR',
            approverId: ids[11],
            departmentId: departments.get('ACC')!,
            status: status === 'APPROVED' ? 'APPROVED' : status === 'PENDING' ? 'PENDING' : 'CANCELLED',
          },
          {
            requestId: r.id,
            sequence: 3,
            type: 'HR',
            approverId: ids[4],
            status: status === 'APPROVED' ? 'APPROVED' : status === 'PENDING' ? 'PENDING' : 'CANCELLED',
          },
        ],
      });
      await tx.leaveLedgerEntry.create({
        data: {
          accountId: account.id,
          requestId: r.id,
          type: 'PENDING_RESERVATION',
          reservedDelta: 1,
          postingKey: `submission:${r.id}`,
        },
      });
      if (status !== 'PENDING')
        await tx.leaveLedgerEntry.create({
          data: {
            accountId: account.id,
            requestId: r.id,
            type: status === 'APPROVED' ? 'APPROVED_LEAVE' : 'RESERVATION_RELEASE',
            reservedDelta: -1,
            usedDelta: status === 'APPROVED' ? 1 : 0,
            postingKey: `decision:${r.id}`,
          },
        });
      await tx.auditEvent.create({
        data: {
          actorId: employeeId,
          action: 'DEMO_LEAVE_CREATED',
          targetType: 'LeaveRequest',
          targetId: r.id,
          metadata: { status },
        },
      });
      await seedApprovalNotification(tx, status, ids[1], r.id);
    }
  });
}

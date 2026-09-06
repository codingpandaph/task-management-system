import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { HR_DELEGABLE, PERMISSIONS } from '@tms/contracts';
import { AppModule } from './app.module';
import { dateOnly, today } from './common/dates';
import { DatabaseService } from './modules/database/database.module';
import { LeaveBalanceService } from './modules/leave/balance.service';
import type { Position } from './generated/prisma/client';

export async function seed(db: DatabaseService) {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true')
    throw new Error('Seeding requires non-production mode and ALLOW_DEMO_SEED=true');
  if (await db.employee.count()) return;
  const passwordHash = await bcrypt.hash('Demo only password 2026!', 12),
    year = Number(today().slice(0, 4));
  const data = JSON.parse(
    await readFile(resolve(process.cwd(), '../../prisma/fixtures/uk-bank-holidays.json'), 'utf8'),
  ) as Record<string, { events: { date: string; title: string }[] }>;
  const events = data['england-and-wales'].events;
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
    const regular = await tx.leavePolicy.create({ data: { name: 'Regular' } }),
      custom = await tx.leavePolicy.create({ data: { name: 'Extended' } });
    const policy = await tx.leavePolicyVersion.create({
      data: { policyId: regular.id, number: 1, vacationDays: 25, sickDays: 5 },
    });
    await tx.leavePolicyVersion.create({ data: { policyId: custom.id, number: 1, vacationDays: 30, sickDays: 8 } });
    const christmas = await tx.christmasPolicy.create({ data: { name: 'Regular Christmas Vacation' } }),
      extended = await tx.christmasPolicy.create({ data: { name: 'Extended Christmas Vacation' } });
    const christmasVersion = await tx.christmasPolicyVersion.create({
      data: { policyId: christmas.id, number: 1, days: 5 },
    });
    await tx.christmasPolicyVersion.create({ data: { policyId: extended.id, number: 1, days: 7 } });
    const departments = new Map<string, string>();
    for (const [code, name] of [
      ['DIR', 'Leadership'],
      ['ACC', 'Client Services'],
      ['MKT', 'Marketing'],
      ['HR', 'Human Resources'],
    ]) {
      const d = await tx.department.create({ data: { code, name, kind: code === 'HR' ? 'HR' : 'OPERATIONAL' } });
      departments.set(code, d.id);
    }
    const people: [string, string, string, Position][] = [
      ['Avery', 'Morgan', 'DIR', 'SENIOR_DIRECTOR'],
      ['Jordan', 'Ellis', 'ACC', 'ACCOUNT_DIRECTOR'],
      ['Casey', 'Rowan', 'MKT', 'ACCOUNT_DIRECTOR'],
      ['Taylor', 'Quinn', 'HR', 'ACCOUNT_DIRECTOR'],
      ['Morgan', 'Reed', 'HR', 'MEMBER'],
      ['Riley', 'Shaw', 'HR', 'MEMBER'],
      ['Alex', 'Finch', 'ACC', 'MEMBER'],
      ['Sam', 'River', 'MKT', 'MEMBER'],
      ['Jamie', 'Brook', 'ACC', 'MEMBER'],
      ['Robin', 'Vale', 'MKT', 'MEMBER'],
      ['Drew', 'Lane', 'ACC', 'MEMBER'],
    ];
    const ids: string[] = [];
    for (const [i, [firstName, lastName, code, position]] of people.entries()) {
      const [sequence] = await tx.$queryRaw<{ value: bigint }[]>`SELECT nextval('employee_id_sequence') AS value`;
      const status = i === 8 ? 'SUSPENDED' : i === 9 ? 'INACTIVE' : 'ACTIVE';
      const employee = await tx.employee.create({
        data: {
          employeeId: `${year}-${code}-${String(sequence.value).padStart(6, '0')}`,
          firstName,
          lastName,
          birthDate: dateOnly('1990-06-15'),
          departmentId: departments.get(code)!,
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
      data: { name: 'CPPinSync', calendarId: calendar.id, hrApproverId: ids[4] },
    });
    const balances = new LeaveBalanceService();
    for (const id of ids) await balances.accounts(tx, id, year);
    for (const [i, status] of (['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).entries()) {
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
      if (status === 'PENDING')
        await tx.notification.create({
          data: {
            recipientId: ids[1],
            type: 'APPROVAL_ASSIGNED',
            title: 'Approval assigned',
            resourceType: 'LeaveRequest',
            resourceId: r.id,
            dedupeKey: `assigned:${r.id}:1`,
          },
        });
    }
  });
}
if (require.main === module) {
  void (async () => {
    const app = await NestFactory.createApplicationContext(AppModule);
    try {
      await seed(app.get(DatabaseService));
      console.log('Fictional seed ready. Credentials are documented in README.');
    } finally {
      await app.close();
    }
  })().catch(() => {
    console.error('Seed failed; verify database and development opt-in.');
    process.exitCode = 1;
  });
}

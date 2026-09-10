import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { seed } from './seed';
import { AuthService } from './modules/auth/auth.service';
import { DatabaseService } from './modules/database/database.module';
import { OrganizationService } from './modules/organization/organization.service';
import { LeaveService } from './modules/leave/leave.service';
import { LeaveApprovalResolver } from './modules/leave/approval.service';
import { LeaveBalanceService } from './modules/leave/balance.service';
import { AccountStatusService } from './modules/employment/account-status.service';
import { today } from './common/dates';
import type { Principal } from './modules/authorization/authorization';
import { PageDto } from './modules/organization/dto';
import { TaskService } from './modules/tasks/task.service';
import { registerTaskIntegrationScenarios } from './task.integration.scenarios';
import { registerTaskWorkflowScenarios } from './task-workflows.integration.scenarios';

test('HR foundation against PostgreSQL', async (suite) => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.pathname, '/tms_test', 'Integration tests require the dedicated tms_test database');
  assert.equal(process.env.NODE_ENV, 'test');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const db = app.get(DatabaseService),
      auth = app.get(AuthService),
      org = app.get(OrganizationService),
      leave = app.get(LeaveService),
      resolver = app.get(LeaveApprovalResolver),
      balance = app.get(LeaveBalanceService),
      status = app.get(AccountStatusService);
    const tasks = app.get(TaskService);
    await seed(db);
    const year = Number(today().slice(0, 4));
    const find = async (firstName: string) => db.employee.findFirstOrThrow({ where: { firstName } });
    const actor = async (firstName: string): Promise<Principal> => {
      const e = await find(firstName);
      const session = await auth.login(e.employeeId, 'Demo only password 2026!');
      return auth.principal(session.access);
    };
    const hr = await actor('Taylor'),
      senior = await actor('Sidney'),
      managing = await actor('Avery'),
      member = await actor('Alex'),
      hrMember = await actor('Riley'),
      accountDirector = await actor('Jordan');
    const policy = await db.leavePolicyVersion.findFirstOrThrow(),
      christmas = await db.christmasPolicyVersion.findFirstOrThrow();
    await suite.test(
      'full seed matches the Managing Director, department leaders, and four 15-member teams',
      async () => {
        assert.equal(await db.department.count(), 3);
        for (const code of ['CLIENT-A', 'CLIENT-B', 'MKT-A', 'MKT-B'])
          assert.equal(
            await db.employee.count({ where: { team: { code }, position: 'MEMBER', status: 'ACTIVE' } }),
            15,
          );
        assert.equal(await db.employee.count({ where: { position: 'SENIOR_DIRECTOR' } }), 3);
        assert.equal(await db.employee.count({ where: { position: 'MANAGING_DIRECTOR', departmentId: null } }), 1);
        assert.equal(await db.team.count({ where: { department: { code: 'ACC' } } }), 2);
        assert.equal(
          await db.employee.count({
            where: { department: { code: { in: ['ACC', 'MKT'] } }, position: 'ACCOUNT_DIRECTOR' },
          }),
          4,
        );
      },
    );
    await suite.test('role matrix grants bounded defaults and gives the Managing Director full access', () => {
      assert.equal(auth.view(member).role, 'MEMBER');
      assert.deepEqual(member.permissions, []);
      assert.equal(auth.view(accountDirector).role, 'ACCOUNT_DIRECTOR');
      assert.deepEqual(accountDirector.permissions, ['REPORTING_READ']);
      assert.equal(auth.view(hrMember).role, 'HR_MEMBER');
      assert.equal(hrMember.permissions.includes('EMPLOYEE_READ'), true);
      assert.equal(hrMember.permissions.includes('EMPLOYEE_STATUS_MANAGE'), false);
      assert.equal(auth.view(hr).role, 'HR_DIRECTOR');
      assert.equal(hr.permissions.includes('LEAVE_ADMIN'), true);
      assert.equal(hr.permissions.includes('PERMISSION_ASSIGN'), false);
      assert.equal(auth.view(senior).role, 'SENIOR_DIRECTOR');
      assert.deepEqual(
        new Set(senior.permissions),
        new Set([
          'EMPLOYEE_READ',
          'DEPARTMENT_UPDATE',
          'DEPARTMENT_ASSIGN_MEMBER',
          'DEPARTMENT_ASSIGN_ACCOUNT_DIRECTOR',
          'REPORTING_READ',
        ]),
      );
      assert.equal(auth.view(managing).role, 'MANAGING_DIRECTOR');
    });
    const suffix = randomUUID().replaceAll('-', '').slice(0, 7).toUpperCase();
    const dep = await org.createDepartment(hr, { code: `T${suffix}`, name: `Integration ${suffix}` });
    const integrationTeam = await org.createTeam(hr, dep.id, { code: 'CORE', name: 'Integration team' });
    const create = async (name: string) =>
      org.create(hr, {
        firstName: name,
        lastName: suffix,
        birthDate: '1991-02-03',
        departmentId: dep.id,
        teamId: integrationTeam.id,
        employmentType: 'FULL_TIME',
        startDate: `${year}-01-01`,
        leavePolicyVersionId: policy.id,
        christmasPolicyVersionId: christmas.id,
      });
    const newcomer = await create('Newstarter');
    await suite.test('IDs are unique, immutable, and concurrency-safe', async () => {
      const results = await Promise.all([create('ConcurrentA'), create('ConcurrentB'), create('ConcurrentC')]);
      assert.equal(new Set(results.map((r) => r.employeeId)).size, 3);
      assert.match(newcomer.employeeId, new RegExp(`^${year}-T${suffix}-\\d{6}$`));
      await assert.rejects(db.employee.update({ where: { id: newcomer.id }, data: { employeeId: 'changed' } }));
      await org.transfer(
        hr,
        newcomer.id,
        member.employee.departmentId!,
        member.employee.teamId!,
        'Integration transfer',
      );
      assert.equal(
        (await db.employee.findUniqueOrThrow({ where: { id: newcomer.id } })).employeeId,
        newcomer.employeeId,
      );
    });
    await suite.test('temporary passwords are hashed, forced change and reset revoke sessions', async () => {
      const stored = await db.employee.findUniqueOrThrow({ where: { id: newcomer.id } });
      assert.notEqual(stored.passwordHash, newcomer.temporaryPassword);
      assert.match(stored.passwordHash, /^\$2[aby]\$/);
      await assert.rejects(auth.login(newcomer.employeeId, 'wrong password'));
      const login = await auth.login(newcomer.employeeId, newcomer.temporaryPassword);
      const p = await auth.principal(login.access);
      assert.equal(p.employee.mustChangePassword, true);
      assert.deepEqual(auth.view(p).permissions, []);
      const changed = await auth.changePassword(p, newcomer.temporaryPassword, 'A different secure password 2026!');
      await assert.rejects(auth.principal(login.access));
      assert.equal((await auth.principal(changed.access)).employee.mustChangePassword, false);
      await org.reset(hr, newcomer.id);
      await assert.rejects(auth.principal(changed.access));
    });
    await suite.test('refresh rotation rejects replay and revokes the session', async () => {
      const e = await find('Riley');
      const login = await auth.login(e.employeeId, 'Demo only password 2026!');
      const rotated = await auth.refresh(login.refresh, login.csrf);
      await assert.rejects(auth.refresh(login.refresh, login.csrf));
      await assert.rejects(auth.principal(rotated.access));
    });
    await suite.test('permissions, self escalation and privacy are enforced', async () => {
      await assert.rejects(org.createDepartment(member, { code: 'NO', name: 'Denied' }));
      await assert.rejects(org.permission(hr, hr.employee.id, { code: 'LEAVE_ADMIN', reason: 'Self grant' }));
      await assert.rejects(
        org.permission(hr, hrMember.employee.id, { code: 'LEAVE_ADMIN', reason: 'Forbidden delegation' }),
      );
      await assert.rejects(
        org.permission(senior, hrMember.employee.id, { code: 'LEAVE_ADMIN', reason: 'Role ceiling' }),
      );
      await assert.rejects(org.detail(member, hr.employee.id));
      const result = await org.employees(member, new PageDto());
      const encoded = JSON.stringify(result);
      for (const forbidden of ['passwordHash', 'birthDate', 'email', 'suspension'])
        assert.ok(!encoded.includes(forbidden));
      assert.ok(!JSON.stringify(auth.view(member)).includes('passwordHash'));
    });
    await suite.test('database prevents duplicate leadership', async () => {
      await assert.rejects(db.employee.update({ where: { id: newcomer.id }, data: { position: 'SENIOR_DIRECTOR' } }));
      await assert.rejects(db.employee.update({ where: { id: newcomer.id }, data: { position: 'ACCOUNT_DIRECTOR' } }));
    });
    await suite.test('exact seven approval chains are resolved', async () => {
      for (const [name, expected] of [
        ['Alex', ['ACCOUNT_DIRECTOR', 'SENIOR_DIRECTOR', 'HR']],
        ['Jordan', ['SENIOR_DIRECTOR', 'HR']],
        ['Avery', []],
        ['Riley', ['ACCOUNT_DIRECTOR', 'SENIOR_DIRECTOR']],
        ['Taylor', ['SENIOR_DIRECTOR']],
        ['Hayden', ['MANAGING_DIRECTOR']],
      ] as const) {
        const employee = await find(name);
        const steps = await db.transaction((tx) => resolver.resolve(tx, employee));
        assert.deepEqual(
          steps.map((s) => s.type),
          [...expected],
        );
      }
    });
    await suite.test('date rules exclude holidays/weekends and restrict Christmas', async () => {
      const days = await db.transaction((tx) => balance.days(tx, `${year}-12-24`, `${year}-12-29`, 'VACATION'));
      assert.ok(days.length < 6);
      assert.ok(!days.some((d) => d.toISOString().slice(5, 10) === '12-25'));
      await assert.rejects(
        db.transaction((tx) => balance.days(tx, `${year}-11-02`, `${year}-11-03`, 'CHRISTMAS_VACATION')),
      );
      await assert.rejects(db.transaction((tx) => balance.days(tx, `${year}-12-31`, `${year + 1}-01-01`, 'VACATION')));
    });
    await suite.test('reservation, ordered approval, duplicate rejection and cancellation reversal', async () => {
      const e = await create('LeaveOwner');
      await org.transfer(hr, e.id, member.employee.departmentId!, member.employee.teamId!, 'Test manager assignment');
      const login = await auth.login(e.employeeId, e.temporaryPassword);
      const p = await auth.principal(login.access);
      // Service tests use a fully authenticated employee after changing the temporary password.
      const changed = await auth.changePassword(p, e.temporaryPassword, 'Leave owner secure password!');
      const owner = await auth.principal(changed.access);
      const before = await leave.balance(owner, year);
      const d = await leave.draft(owner, { type: 'VACATION', startDate: `${year}-12-01`, endDate: `${year}-12-02` });
      await leave.submit(owner, d.id, randomUUID());
      const reserved = await leave.balance(owner, year);
      assert.equal(reserved.find((b) => b.type === 'VACATION')!.reserved, 2);
      await assert.rejects(leave.decide(hr, d.id, { decision: 'APPROVED' }));
      const director = await actor('Jordan'),
        departmentDirector = await actor('Sidney'),
        approver = await actor('Morgan');
      await leave.decide(director, d.id, { decision: 'APPROVED' });
      await assert.rejects(leave.decide(director, d.id, { decision: 'APPROVED' }));
      await leave.decide(departmentDirector, d.id, { decision: 'APPROVED' });
      await leave.decide(approver, d.id, { decision: 'APPROVED' });
      const used = await leave.balance(owner, year);
      assert.equal(used.find((b) => b.type === 'VACATION')!.used, 2);
      assert.equal(used.find((b) => b.type === 'VACATION')!.reserved, 0);
      const c = await leave.cancel(owner, d.id, { reason: 'Plans changed', operationId: randomUUID() });
      assert.equal((await leave.balance(owner, year)).find((b) => b.type === 'VACATION')!.used, 2);
      await leave.decideCancellation(director, c.id, { decision: 'APPROVED' });
      await leave.decideCancellation(departmentDirector, c.id, { decision: 'APPROVED' });
      await leave.decideCancellation(approver, c.id, { decision: 'APPROVED' });
      assert.deepEqual(await leave.balance(owner, year), before);
    });
    await suite.test('concurrent overlapping submissions cannot both reserve', async () => {
      const e = await create('RaceOwner');
      await org.transfer(hr, e.id, member.employee.departmentId!, member.employee.teamId!, 'Test assignment');
      const login = await auth.login(e.employeeId, e.temporaryPassword);
      const changed = await auth.changePassword(
        await auth.principal(login.access),
        e.temporaryPassword,
        'Concurrent leave safe password!',
      );
      const p = await auth.principal(changed.access);
      const a = await leave.draft(p, { type: 'VACATION', startDate: `${year}-12-07`, endDate: `${year}-12-08` }),
        b = await leave.draft(p, { type: 'VACATION', startDate: `${year}-12-07`, endDate: `${year}-12-08` });
      const results = await Promise.allSettled([
        leave.submit(p, a.id, randomUUID()),
        leave.submit(p, b.id, randomUUID()),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    });
    await suite.test('suspension revokes access and expiry respects current eligibility', async () => {
      const e = await create('SuspendOwner');
      const login = await auth.login(e.employeeId, e.temporaryPassword);
      await org.status(hr, e.id, 'SUSPENDED', 'Integration suspension', new Date(Date.now() + 60000).toISOString());
      await assert.rejects(auth.principal(login.access));
      await assert.rejects(auth.login(e.employeeId, e.temporaryPassword));
      assert.equal(await db.transaction((tx) => status.eligible(tx, e.id, new Date(Date.now() + 120000))), true);
      await assert.rejects(auth.principal(login.access));
      await org.status(hr, e.id, 'TERMINATED', 'Integration termination');
      assert.equal(await db.transaction((tx) => status.eligible(tx, e.id)), false);
    });
    await suite.test('contract expiry blocks access; probation expiry does not', async () => {
      const inactive = await find('Robin');
      await assert.rejects(auth.login(inactive.employeeId, 'Demo only password 2026!'));
      const probation = await find('Sam');
      assert.equal(
        await db.transaction((tx) => status.eligible(tx, probation.id, new Date(`${year}-12-01T12:00:00Z`))),
        true,
      );
    });
    await suite.test('audit and ledger reject updates and contain no credentials', async () => {
      const a = await db.auditEvent.findFirstOrThrow();
      await assert.rejects(db.auditEvent.update({ where: { id: a.id }, data: { action: 'tamper' } }));
      const l = await db.leaveLedgerEntry.findFirstOrThrow();
      await assert.rejects(db.leaveLedgerEntry.update({ where: { id: l.id }, data: { usedDelta: 999 } }));
      const text = JSON.stringify(await db.auditEvent.findMany());
      assert.ok(!text.includes('Demo only password'));
      assert.ok(!text.includes('passwordHash'));
    });
    await registerTaskIntegrationScenarios(suite, {
      actor,
      db,
      dep,
      find,
      hr,
      hrMember,
      leave,
      member,
      org,
      senior,
      tasks,
      year,
    });
    await registerTaskWorkflowScenarios(suite, { actor, db, find, member, tasks, year });
    await suite.test('database enforces one active leader at every hierarchy scope', async () => {
      await assert.rejects(
        db.employee.update({
          where: { id: newcomer.id },
          data: { position: 'MANAGING_DIRECTOR', departmentId: null, teamId: null },
        }),
      );
      assert.equal(await db.employee.count({ where: { position: 'MANAGING_DIRECTOR', status: 'ACTIVE' } }), 1);
    });
  } finally {
    await app.close();
  }
});

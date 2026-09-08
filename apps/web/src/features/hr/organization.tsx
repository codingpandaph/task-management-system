'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee, DirectoryEmployee, PageResult } from '@tms/contracts';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LoadingState, message } from './ui';
import { OrganizationDirectoryView } from './organization-directory-view';
import { OrganizationEmployeeView } from './organization-employee-view';
import { OrganizationOverviewView } from './organization-overview-view';
import { OrganizationPoliciesView } from './organization-policies-view';
import type { Department, EmployeeDetail, EmploymentRecord, PermissionGrant, Policy } from './organization-types';

export function OrganizationScreens({ path, user }: { path: string; user: CurrentEmployee }) {
  const [departments, setDepartments] = useState<Department[]>([]),
    [people, setPeople] = useState<PageResult<DirectoryEmployee>>({ items: [], total: 0, page: 1, pageSize: 20 }),
    [policies, setPolicies] = useState<{ leave: Policy[]; christmas: Policy[] }>({ leave: [], christmas: [] }),
    [detail, setDetail] = useState<EmployeeDetail | null>(null),
    [employment, setEmployment] = useState<EmploymentRecord[]>([]),
    [permissionGrants, setPermissionGrants] = useState<PermissionGrant[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [department, setDepartment] = useState(''),
    [position, setPosition] = useState(''),
    [status, setStatus] = useState(''),
    [policyTab, setPolicyTab] = useState(0),
    [employeeTab, setEmployeeTab] = useState(0),
    [policySearch, setPolicySearch] = useState(''),
    [revision, setRevision] = useState(0),
    [secret, setSecret] = useState('');
  const can = (p: CurrentEmployee['permissions'][number]) => user.permissions.includes(p);
  const id = path.startsWith('/employees/') ? path.split('/')[2] : undefined;
  useEffect(() => {
    let active = true;
    Promise.all([
      api<Department[]>('departments'),
      api<{ leave: Policy[]; christmas: Policy[] }>('policies'),
      api<PageResult<DirectoryEmployee>>(
        `${can('EMPLOYEE_READ') ? 'employees' : 'directory/employees'}?page=${page}&search=${encodeURIComponent(search)}${department ? `&departmentId=${department}` : ''}${position ? `&position=${position}` : ''}${status ? `&status=${status}` : ''}`,
      ),
    ])
      .then(([d, p, e]) => {
        if (active) {
          setDepartments(d);
          setPolicies(p);
          setPeople(e);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      })
      .finally(() => {
        if (active && !id) setLoading(false);
      });
    if (id)
      api<EmployeeDetail>(`employees/${id}`)
        .then((d) => {
          if (active) setDetail(d);
        })
        .catch((e) => {
          if (active) setError(message(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    if (id && can('EMPLOYMENT_MANAGE'))
      api<EmploymentRecord[]>(`employees/${id}/employment-records`)
        .then((records) => {
          if (active) setEmployment(records);
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    if (id && can('EMPLOYEE_READ'))
      api<PermissionGrant[]>(`employees/${id}/permissions`)
        .then((grants) => {
          if (active) setPermissionGrants(grants);
        })
        .catch((e) => {
          if (active) setError(message(e));
        });
    return () => {
      active = false;
    };
  }, [id, page, search, department, position, status, revision, user.permissions]); // eslint-disable-line react-hooks/exhaustive-deps
  const options = departments.filter((d) => d.status === 'ACTIVE').map((d) => ({ value: d.id, label: d.name }));
  const employeeOptions = people.items.map((e) => ({ value: e.id, label: e.displayName }));
  const policyOptions = policies.leave.flatMap(
    (p) =>
      p.leavePolicyVersion_policy
        ?.slice(0, 1)
        .map((v) => ({ value: v.id, label: `${p.name} · ${v.vacationDays} VL / ${v.sickDays} SL` })) ?? [],
  );
  const christmasOptions = policies.christmas.flatMap(
    (p) =>
      p.christmasPolicyVersion_policy?.slice(0, 1).map((v) => ({ value: v.id, label: `${p.name} · ${v.days} days` })) ??
      [],
  );
  async function save(endpoint: string, values: Record<string, string | number>, method = 'POST') {
    await api(endpoint, values, method);
    setRevision((v) => v + 1);
  }
  const credentialDialog = (
    <Dialog open={!!secret} onClose={() => setSecret('')} fullWidth>
      <DialogTitle>One-time temporary password</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Share this securely. It cannot be retrieved after closing.
        </Alert>
        <Typography component="pre" sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
          {secret}
        </Typography>
        <Button onClick={() => setSecret('')}>Close and clear password</Button>
      </DialogContent>
    </Dialog>
  );
  if (loading) return <LoadingState label="Loading organization data" />;
  if (id)
    return (
      <OrganizationEmployeeView
        can={can}
        christmasOptions={christmasOptions}
        credentialDialog={credentialDialog}
        detail={detail}
        employeeTab={employeeTab}
        employment={employment}
        error={error}
        id={id}
        options={options}
        permissionGrants={permissionGrants}
        policyOptions={policyOptions}
        save={save}
        setEmployeeTab={setEmployeeTab}
        setSecret={setSecret}
        user={user}
      />
    );
  if (path === '/policies')
    return (
      <OrganizationPoliciesView
        can={can}
        error={error}
        policies={policies}
        save={save}
        search={policySearch}
        setSearch={setPolicySearch}
        setTab={setPolicyTab}
        tab={policyTab}
      />
    );
  if (path.startsWith('/organization'))
    return (
      <OrganizationOverviewView
        can={can}
        departments={departments}
        employeeOptions={employeeOptions}
        error={error}
        options={options}
        people={people}
        save={save}
        user={user}
      />
    );
  return (
    <OrganizationDirectoryView
      can={can}
      christmasOptions={christmasOptions}
      credentialDialog={credentialDialog}
      department={department}
      departments={departments}
      error={error}
      onCreate={async (values) => {
        const result = await api<{ employeeId: string; temporaryPassword: string }>('employees', values);
        setSecret(`${result.employeeId}\n${result.temporaryPassword}`);
        setRevision((value) => value + 1);
      }}
      options={options}
      page={page}
      people={people}
      policyOptions={policyOptions}
      position={position}
      search={search}
      setDepartment={setDepartment}
      setPage={setPage}
      setPosition={setPosition}
      setSearch={setSearch}
      setStatus={setStatus}
      status={status}
    />
  );
}

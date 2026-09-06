'use client';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import InputAdornment from '@mui/material/InputAdornment';
import AddBusinessOutlined from '@mui/icons-material/AddBusinessOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { PERMISSIONS, type CurrentEmployee, type DirectoryEmployee, type PageResult } from '@tms/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, message, ModalForm, StatusTag, Tag, type Field } from './ui';
interface Department {
  id: string;
  name: string;
  code: string;
  status: string;
  version: number;
}
interface Policy {
  id: string;
  name: string;
  status: string;
  leavePolicyVersion_policy?: { id: string; vacationDays: number; sickDays: number }[];
  christmasPolicyVersion_policy?: { id: string; days: number }[];
}
interface EmployeeDetail extends DirectoryEmployee {
  firstName: string;
  middleName?: string;
  lastName: string;
  status: string;
  version: number;
  birthDate?: string;
  email?: string;
}
interface EmploymentRecord {
  id: string;
  type: string;
  startDate: string;
  endDate?: string;
  probationEnd?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  reason: string;
}
interface PermissionGrant {
  id: string;
  permission: { code: string };
}
const reason: Field = { name: 'reason', label: 'Reason' };
export function OrganizationScreens({ path, user }: { path: string; user: CurrentEmployee }) {
  const [departments, setDepartments] = useState<Department[]>([]),
    [people, setPeople] = useState<PageResult<DirectoryEmployee>>({ items: [], total: 0, page: 1, pageSize: 20 }),
    [policies, setPolicies] = useState<{ leave: Policy[]; christmas: Policy[] }>({ leave: [], christmas: [] }),
    [detail, setDetail] = useState<EmployeeDetail | null>(null),
    [employment, setEmployment] = useState<EmploymentRecord[]>([]),
    [permissionGrants, setPermissionGrants] = useState<PermissionGrant[]>([]),
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
      });
    if (id)
      api<EmployeeDetail>(`employees/${id}`)
        .then((d) => {
          if (active) setDetail(d);
        })
        .catch((e) => {
          if (active) setError(message(e));
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
  if (id)
    return (
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        {detail && (
          <>
            <Card title="Employee profile" className="profile-card">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ alignItems: { sm: 'center' } }}>
                <Avatar sx={{ width: 68, height: 68, bgcolor: '#244f40', fontSize: 22 }}>
                  {detail.displayName
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </Avatar>
                <div>
                  <Typography variant="h4" component="h2">
                    {detail.displayName}
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
                    <StatusTag value={detail.status} />
                    <Tag value={detail.position} />
                    <Tag value={detail.department.name} tone="teal" />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {detail.employeeId}
                  </Typography>
                </div>
              </Stack>
              <Tabs
                value={employeeTab}
                onChange={(_, value: number) => setEmployeeTab(value)}
                aria-label="Employee profile sections"
                variant="scrollable"
                sx={{ mt: 3 }}
              >
                <Tab label="Overview" />
                <Tab label="Employment" />
                <Tab label="Leave policies" />
                <Tab label="Access & security" />
              </Tabs>
              {employeeTab === 0 && (
                <div className="profile-facts">
                  <div>
                    <span>Department</span>
                    <strong>{detail.department.name}</strong>
                  </div>
                  <div>
                    <span>Position</span>
                    <strong>{detail.position.replaceAll('_', ' ')}</strong>
                  </div>
                  {detail.email && (
                    <div>
                      <span>Email</span>
                      <strong>{detail.email}</strong>
                    </div>
                  )}
                  {detail.birthDate && (
                    <div>
                      <span>Birth date</span>
                      <strong>{detail.birthDate}</strong>
                    </div>
                  )}
                </div>
              )}
              {employeeTab === 1 && (
                <Stack spacing={2} sx={{ mt: 3 }}>
                  <Typography color="text.secondary">
                    Effective-dated employment history, with the current record first.
                  </Typography>
                  {employment.length ? (
                    <div className="table-scroll">
                      <Table size="small" aria-label="Employment history">
                        <TableHead>
                          <TableRow>
                            <TableCell>Type</TableCell>
                            <TableCell>Employment dates</TableCell>
                            <TableCell>Effective period</TableCell>
                            <TableCell>Reason</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {employment.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>
                                <Tag value={record.type} tone="blue" />
                              </TableCell>
                              <TableCell>
                                {record.startDate.slice(0, 10)} – {record.endDate?.slice(0, 10) ?? 'Open-ended'}
                                {record.probationEnd && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    Review {record.probationEnd.slice(0, 10)}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {record.effectiveFrom.slice(0, 10)} – {record.effectiveTo?.slice(0, 10) ?? 'Current'}
                              </TableCell>
                              <TableCell>{record.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <EmptyState title="No employment history" detail="Add the employee’s first employment record." />
                  )}
                </Stack>
              )}
              {employeeTab === 2 && (
                <Typography color="text.secondary" sx={{ mt: 3 }}>
                  Assign next-year regular and Christmas leave policies.
                </Typography>
              )}
              {employeeTab === 3 && (
                <Stack spacing={2} sx={{ mt: 3 }}>
                  <Typography color="text.secondary">Current explicit access grants for this employee.</Typography>
                  {permissionGrants.length ? (
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {permissionGrants.map((grant) => (
                        <Tag key={grant.id} value={grant.permission.code} tone="purple" />
                      ))}
                    </Stack>
                  ) : (
                    <EmptyState
                      title="No explicit permissions"
                      detail="This employee only has standard account access."
                    />
                  )}
                </Stack>
              )}
            </Card>
            <Card
              title={['Profile actions', 'Employment actions', 'Policy assignments', 'Access controls'][employeeTab]}
              className="action-bar"
            >
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Choose an action. Each change opens in its own review dialog.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {employeeTab === 0 && can('EMPLOYEE_UPDATE') && (
                  <ModalForm
                    buttonLabel="Edit profile"
                    icon={<EditOutlined />}
                    title="Edit basic information"
                    fields={[
                      { name: 'firstName', label: 'First name', value: detail.firstName },
                      { name: 'middleName', label: 'Middle name', optional: true, value: detail.middleName },
                      { name: 'lastName', label: 'Last name', value: detail.lastName },
                      { name: 'email', label: 'Email', type: 'email', optional: true, value: detail.email },
                    ]}
                    onSubmit={(v) => save(`employees/${id}`, { ...v, version: detail.version }, 'PATCH')}
                  />
                )}
                {employeeTab === 0 && can('DEPARTMENT_ASSIGN_MEMBER') && (
                  <ModalForm
                    buttonLabel="Transfer department"
                    icon={<ManageAccountsOutlined />}
                    title="Transfer department"
                    fields={[{ name: 'departmentId', label: 'Department', options }, reason]}
                    onSubmit={(v) => save(`employees/${id}/transfer`, v)}
                  />
                )}
                {employeeTab === 3 && can('EMPLOYEE_STATUS_MANAGE') && (
                  <ModalForm
                    buttonLabel="Suspend access"
                    title="Suspend employee access"
                    submitLabel="Suspend employee"
                    fields={[reason, { name: 'suspendedUntil', label: 'Suspended until', type: 'datetime-local' }]}
                    onSubmit={(v) =>
                      save(`employees/${id}/suspend`, {
                        ...v,
                        suspendedUntil: new Date(String(v.suspendedUntil)).toISOString(),
                      })
                    }
                  />
                )}
                {employeeTab === 3 && can('EMPLOYEE_STATUS_MANAGE') && (
                  <ModalForm
                    buttonLabel="Change status"
                    title="Change account status"
                    fields={[
                      {
                        name: 'action',
                        label: 'Action',
                        options: [
                          { value: 'deactivate', label: 'Deactivate' },
                          { value: 'reactivate', label: 'Reactivate' },
                          { value: 'terminate', label: 'Terminate' },
                        ],
                      },
                      reason,
                    ]}
                    onSubmit={async ({ action, ...v }) => save(`employees/${id}/${action}`, v)}
                  />
                )}
                {employeeTab === 3 && can('EMPLOYEE_PASSWORD_RESET') && (
                  <ModalForm
                    buttonLabel="Reset password"
                    title="Reset employee password"
                    submitLabel="Generate temporary password"
                    fields={[reason]}
                    onSubmit={async (v) => {
                      const r = await api<{ temporaryPassword: string }>(`employees/${id}/reset-password`, v);
                      setSecret(r.temporaryPassword);
                    }}
                  />
                )}
                {employeeTab === 1 && can('EMPLOYMENT_MANAGE') && (
                  <ModalForm
                    buttonLabel="Add employment record"
                    title="Add employment record"
                    fields={[
                      {
                        name: 'type',
                        label: 'Employment type',
                        options: ['FULL_TIME', 'CONTRACTUAL', 'PROBATIONARY'].map((value) => ({
                          value,
                          label: value.replaceAll('_', ' '),
                        })),
                      },
                      { name: 'startDate', label: 'Employment start', type: 'date' },
                      { name: 'endDate', label: 'Contract end', type: 'date', optional: true },
                      { name: 'probationEnd', label: 'Probation review', type: 'date', optional: true },
                      reason,
                    ]}
                    onSubmit={(v) => save(`employees/${id}/employment-records`, v)}
                  />
                )}
                {employeeTab === 3 && (can('PERMISSION_ASSIGN') || user.position === 'SENIOR_DIRECTOR') && (
                  <ModalForm
                    buttonLabel="Manage permissions"
                    title="Manage permissions"
                    fields={[
                      {
                        name: 'code',
                        label: 'Permission',
                        options: PERMISSIONS.map((value) => ({ value, label: value })),
                      },
                      {
                        name: 'action',
                        label: 'Change',
                        options: [
                          { value: 'grant', label: 'Grant' },
                          { value: 'revoke', label: 'Revoke' },
                        ],
                      },
                      reason,
                    ]}
                    onSubmit={async ({ action, ...v }) =>
                      save(`employees/${id}/permissions${action === 'revoke' ? '/revoke' : ''}`, v)
                    }
                  />
                )}
                {employeeTab === 2 && can('LEAVE_POLICY_MANAGE') && (
                  <ModalForm
                    buttonLabel="Assign leave policy"
                    title="Assign next-year leave policy"
                    fields={[
                      { name: 'policyVersionId', label: 'Policy', options: policyOptions },
                      { name: 'year', label: 'Leave year', type: 'number', value: new Date().getFullYear() + 1 },
                    ]}
                    onSubmit={(v) => save(`employees/${id}/leave-policy`, v)}
                  />
                )}
                {employeeTab === 2 && can('CHRISTMAS_POLICY_MANAGE') && (
                  <ModalForm
                    buttonLabel="Assign Christmas policy"
                    title="Assign next-year Christmas policy"
                    fields={[
                      { name: 'policyVersionId', label: 'Policy', options: christmasOptions },
                      { name: 'year', label: 'Leave year', type: 'number', value: new Date().getFullYear() + 1 },
                    ]}
                    onSubmit={(v) => save(`employees/${id}/christmas-policy`, v)}
                  />
                )}
              </Stack>
            </Card>
          </>
        )}
        {credentialDialog}
      </Stack>
    );
  if (path === '/policies')
    return (
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        <Card title="Policy catalogue">
          <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 2, mb: 2 }}>
            <Tabs value={policyTab} onChange={(_, value: number) => setPolicyTab(value)} aria-label="Policy types">
              <Tab label={`Regular leave (${policies.leave.length})`} />
              <Tab label={`Christmas (${policies.christmas.length})`} />
            </Tabs>
            <TextField
              label="Search policies"
              value={policySearch}
              onChange={(event) => setPolicySearch(event.target.value)}
            />
          </Stack>
          <div className="policy-grid">
            {(policyTab === 0 ? policies.leave : policies.christmas)
              .filter((policy) => policy.name.toLowerCase().includes(policySearch.toLowerCase()))
              .map((policy) => {
                const allowance =
                  policyTab === 0
                    ? `${policy.leavePolicyVersion_policy?.[0]?.vacationDays} vacation · ${policy.leavePolicyVersion_policy?.[0]?.sickDays} sick`
                    : `${policy.christmasPolicyVersion_policy?.[0]?.days} Christmas days`;
                return (
                  <div className="policy-tile" key={policy.id}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                      <Typography sx={{ fontWeight: 700 }}>{policy.name}</Typography>
                      <StatusTag value={policy.status} />
                    </Stack>
                    <Typography variant="h6" sx={{ mt: 2 }}>
                      {allowance}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Current version · annual entitlement
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      {((policyTab === 0 && can('LEAVE_POLICY_MANAGE')) ||
                        (policyTab === 1 && can('CHRISTMAS_POLICY_MANAGE'))) && (
                        <ModalForm
                          buttonLabel="New version"
                          title={`Create a new version of ${policy.name}`}
                          fields={
                            policyTab === 0
                              ? [
                                  { name: 'name', label: 'Policy name', value: policy.name },
                                  {
                                    name: 'vacationDays',
                                    label: 'Vacation days',
                                    type: 'number',
                                    value: policy.leavePolicyVersion_policy?.[0]?.vacationDays,
                                  },
                                  {
                                    name: 'sickDays',
                                    label: 'Sick days',
                                    type: 'number',
                                    value: policy.leavePolicyVersion_policy?.[0]?.sickDays,
                                  },
                                ]
                              : [
                                  { name: 'name', label: 'Policy name', value: policy.name },
                                  {
                                    name: 'days',
                                    label: 'Days',
                                    type: 'number',
                                    value: policy.christmasPolicyVersion_policy?.[0]?.days,
                                  },
                                ]
                          }
                          onSubmit={(values) =>
                            save(`${policyTab === 0 ? 'leave' : 'christmas'}-policies/${policy.id}/versions`, values)
                          }
                        />
                      )}
                      {((policyTab === 0 && can('LEAVE_POLICY_MANAGE')) ||
                        (policyTab === 1 && can('CHRISTMAS_POLICY_MANAGE'))) && (
                        <Button
                          color={policy.status === 'ACTIVE' ? 'warning' : 'success'}
                          onClick={() =>
                            save(`${policyTab === 0 ? 'leave' : 'christmas'}-policies/${policy.id}/status`, {
                              status: policy.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                            })
                          }
                        >
                          {policy.status === 'ACTIVE' ? 'Make inactive' : 'Activate'}
                        </Button>
                      )}
                    </Stack>
                  </div>
                );
              })}
          </div>
        </Card>
        <Card title="Policy actions" className="action-bar">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {can('LEAVE_POLICY_MANAGE') && (
              <ModalForm
                buttonLabel="Create leave policy"
                icon={<AddOutlined />}
                title="Create leave policy"
                variant="contained"
                fields={[
                  { name: 'name', label: 'Policy name' },
                  { name: 'vacationDays', label: 'Vacation days', type: 'number' },
                  { name: 'sickDays', label: 'Sick days', type: 'number' },
                ]}
                onSubmit={(v) => save('leave-policies', v)}
              />
            )}
            {can('CHRISTMAS_POLICY_MANAGE') && (
              <ModalForm
                buttonLabel="Create Christmas policy"
                icon={<AddOutlined />}
                title="Create Christmas policy"
                fields={[
                  { name: 'name', label: 'Policy name' },
                  { name: 'days', label: 'Days', type: 'number' },
                ]}
                onSubmit={(v) => save('christmas-policies', v)}
              />
            )}
          </Stack>
        </Card>
      </Stack>
    );
  if (path.startsWith('/organization'))
    return (
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        <div className="grid-two">
          {departments.map((d) => (
            <Card key={d.id} title={d.name}>
              <Tag value={d.code} tone="teal" />
              <Stack direction="row" spacing={1} sx={{ my: 2 }}>
                <StatusTag value={d.status} />
                <Tag value={`${people.items.filter((e) => e.department.id === d.id).length} people`} />
              </Stack>
              {people.items
                .filter((e) => e.department.id === d.id)
                .map((e) => (
                  <Typography key={e.id}>
                    {e.displayName} · {e.position.replaceAll('_', ' ')}
                  </Typography>
                ))}
              {can('DEPARTMENT_UPDATE') && (
                <ModalForm
                  buttonLabel="Edit department"
                  title={`Edit ${d.name}`}
                  fields={[
                    { name: 'name', label: 'Department name', value: d.name },
                    { name: 'description', label: 'Description', optional: true },
                  ]}
                  onSubmit={(v) => save(`departments/${d.id}`, { ...v, version: d.version }, 'PATCH')}
                />
              )}
            </Card>
          ))}
        </div>
        <Card title="Organization actions" className="action-bar">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {can('DEPARTMENT_CREATE') && (
              <ModalForm
                buttonLabel="Create department"
                icon={<AddBusinessOutlined />}
                title="Create a department"
                variant="contained"
                submitLabel="Create department"
                fields={[
                  { name: 'code', label: 'Department code' },
                  { name: 'name', label: 'Department name' },
                  { name: 'description', label: 'Description', optional: true },
                ]}
                onSubmit={(v) => save('departments', v)}
              />
            )}
            {can('DEPARTMENT_ASSIGN_ACCOUNT_DIRECTOR') && (
              <ModalForm
                buttonLabel="Assign Account Director"
                icon={<BadgeOutlined />}
                title="Assign Account Director"
                fields={[
                  { name: 'departmentId', label: 'Department', options },
                  { name: 'employeeId', label: 'Employee', options: employeeOptions },
                  reason,
                ]}
                onSubmit={async ({ departmentId, ...v }) => save(`departments/${departmentId}/director`, v)}
              />
            )}
            {user.position === 'SENIOR_DIRECTOR' && (
              <ModalForm
                buttonLabel="Governance assignment"
                title="Governance assignment"
                fields={[
                  {
                    name: 'action',
                    label: 'Assignment',
                    options: [
                      { value: 'hr-approver', label: 'Final HR approver' },
                      { value: 'senior-director', label: 'Senior Director successor' },
                    ],
                  },
                  { name: 'employeeId', label: 'Employee', options: employeeOptions },
                  reason,
                ]}
                onSubmit={async ({ action, ...v }) => save(`organization/${action}`, v)}
              />
            )}
          </Stack>
        </Card>
      </Stack>
    );
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <Card title="People directory">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="Search people"
            placeholder="Name or Employee ID"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            size="small"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            label="Department"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All departments</MenuItem>
            {departments.map((d) => (
              <MenuItem value={d.id} key={d.id}>
                {d.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Position"
            value={position}
            onChange={(event) => {
              setPosition(event.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">All positions</MenuItem>
            <MenuItem value="MEMBER">Member</MenuItem>
            <MenuItem value="ACCOUNT_DIRECTOR">Account Director</MenuItem>
            <MenuItem value="SENIOR_DIRECTOR">Senior Director</MenuItem>
          </TextField>
          {can('EMPLOYEE_READ') && (
            <TextField
              select
              label="Status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All statuses</MenuItem>
              {['ACTIVE', 'SUSPENDED', 'INACTIVE', 'TERMINATED'].map((value) => (
                <MenuItem key={value} value={value}>
                  {value.toLowerCase()}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
        <div className="table-scroll">
          <Table>
            <TableHead>
              <TableRow>
                {['Name', 'Employee ID', 'Department', 'Position'].map((h) => (
                  <TableCell key={h}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {people.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                      <Avatar sx={{ width: 34, height: 34, bgcolor: '#e2ede6', color: '#244f40', fontSize: 12 }}>
                        {e.displayName
                          .split(' ')
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join('')}
                      </Avatar>
                      {can('EMPLOYEE_READ') ? <Link href={`/employees/${e.id}`}>{e.displayName}</Link> : e.displayName}
                    </Stack>
                  </TableCell>
                  <TableCell>{e.employeeId}</TableCell>
                  <TableCell>{e.department.name}</TableCell>
                  <TableCell>
                    <Tag value={e.position} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!people.items.length && (
          <EmptyState title="No people found" detail="Try removing a filter or search by Employee ID." />
        )}
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Typography sx={{ alignSelf: 'center' }}>
            {people.total} people · Page {page}
          </Typography>
          <Button disabled={page * 20 >= people.total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </Stack>
      </Card>
      {can('EMPLOYEE_CREATE') && (
        <Card title="People actions" className="action-bar">
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Add a new employee without leaving the directory.
          </Typography>
          <ModalForm
            buttonLabel="Add employee"
            icon={<PersonAddAltOutlined />}
            title="Add a new employee"
            variant="contained"
            submitLabel="Create employee"
            fields={[
              { name: 'firstName', label: 'First name' },
              { name: 'middleName', label: 'Middle name', optional: true },
              { name: 'lastName', label: 'Last name' },
              { name: 'birthDate', label: 'Birth date', type: 'date' },
              { name: 'email', label: 'Email', type: 'email', optional: true },
              { name: 'departmentId', label: 'Department', options },
              {
                name: 'employmentType',
                label: 'Employment type',
                options: ['FULL_TIME', 'CONTRACTUAL', 'PROBATIONARY'].map((value) => ({
                  value,
                  label: value.replaceAll('_', ' '),
                })),
              },
              { name: 'startDate', label: 'Employment start', type: 'date' },
              { name: 'endDate', label: 'Contract end', type: 'date', optional: true },
              { name: 'probationEnd', label: 'Probation review', type: 'date', optional: true },
              { name: 'leavePolicyVersionId', label: 'Leave policy', options: policyOptions },
              { name: 'christmasPolicyVersionId', label: 'Christmas policy', options: christmasOptions },
            ]}
            onSubmit={async (v) => {
              const r = await api<{ employeeId: string; temporaryPassword: string }>('employees', v);
              setSecret(`${r.employeeId}\n${r.temporaryPassword}`);
              setRevision((n) => n + 1);
            }}
          />
        </Card>
      )}
      {credentialDialog}
    </Stack>
  );
}

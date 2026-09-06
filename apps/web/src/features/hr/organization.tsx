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
import Chip from '@mui/material/Chip';
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
import { Card, EmptyState, message, ModalForm, StatusTag, type Field } from './ui';
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
const reason: Field = { name: 'reason', label: 'Reason' };
export function OrganizationScreens({ path, user }: { path: string; user: CurrentEmployee }) {
  const [departments, setDepartments] = useState<Department[]>([]),
    [people, setPeople] = useState<PageResult<DirectoryEmployee>>({ items: [], total: 0, page: 1, pageSize: 20 }),
    [policies, setPolicies] = useState<{ leave: Policy[]; christmas: Policy[] }>({ leave: [], christmas: [] }),
    [detail, setDetail] = useState<EmployeeDetail | null>(null),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(1),
    [department, setDepartment] = useState(''),
    [position, setPosition] = useState(''),
    [status, setStatus] = useState(''),
    [policyTab, setPolicyTab] = useState(0),
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
            <Card title={detail.displayName}>
              <Typography>
                {detail.employeeId} · {detail.department.name}
              </Typography>
              <StatusTag value={detail.status} />
              {detail.birthDate && <Typography sx={{ mt: 2 }}>Birth date: {detail.birthDate}</Typography>}
            </Card>
            <Card title="Employee actions" className="action-bar">
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Choose an action. Each change opens in its own review dialog.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {can('EMPLOYEE_UPDATE') && (
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
                {can('DEPARTMENT_ASSIGN_MEMBER') && (
                  <ModalForm
                    buttonLabel="Transfer department"
                    icon={<ManageAccountsOutlined />}
                    title="Transfer department"
                    fields={[{ name: 'departmentId', label: 'Department', options }, reason]}
                    onSubmit={(v) => save(`employees/${id}/transfer`, v)}
                  />
                )}
                {can('EMPLOYEE_STATUS_MANAGE') && (
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
                {can('EMPLOYEE_STATUS_MANAGE') && (
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
                {can('EMPLOYEE_PASSWORD_RESET') && (
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
                {can('EMPLOYMENT_MANAGE') && (
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
                {(can('PERMISSION_ASSIGN') || user.position === 'SENIOR_DIRECTOR') && (
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
                {can('LEAVE_POLICY_MANAGE') && (
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
                {can('CHRISTMAS_POLICY_MANAGE') && (
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
          {policyTab === 0
            ? policies.leave
                .filter((policy) => policy.name.toLowerCase().includes(policySearch.toLowerCase()))
                .map((p) => (
                  <Typography component="div" key={p.id} sx={{ mb: 1 }}>
                    {p.name} <StatusTag value={p.status} /> · {p.leavePolicyVersion_policy?.[0]?.vacationDays} VL /{' '}
                    {p.leavePolicyVersion_policy?.[0]?.sickDays} SL
                  </Typography>
                ))
            : policies.christmas
                .filter((policy) => policy.name.toLowerCase().includes(policySearch.toLowerCase()))
                .map((p) => (
                  <Typography component="div" key={p.id} sx={{ mb: 1 }}>
                    {p.name} <StatusTag value={p.status} /> · {p.christmasPolicyVersion_policy?.[0]?.days} days
                  </Typography>
                ))}
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
              <Chip label={d.code} size="small" />
              <Stack direction="row" spacing={1} sx={{ my: 2 }}>
                <StatusTag value={d.status} />
                <Chip label={`${people.items.filter((e) => e.department.id === d.id).length} people`} size="small" />
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
                    <Chip label={e.position.replaceAll('_', ' ').toLowerCase()} size="small" variant="outlined" />
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

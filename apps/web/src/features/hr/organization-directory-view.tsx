import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee, DirectoryEmployee, PageResult } from '@tms/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, EmptyState, ModalForm, Tag } from './ui';
import type { Department } from './organization-types';

export function OrganizationDirectoryView({
  can,
  christmasOptions,
  credentialDialog,
  department,
  departments,
  error,
  onCreate,
  options,
  page,
  people,
  policyOptions,
  position,
  search,
  setDepartment,
  setPage,
  setPosition,
  setSearch,
  setStatus,
  status,
}: {
  can: (permission: CurrentEmployee['permissions'][number]) => boolean;
  christmasOptions: { value: string; label: string }[];
  credentialDialog: ReactNode;
  department: string;
  departments: Department[];
  error: string;
  onCreate: (values: Record<string, string | number>) => Promise<void>;
  options: { value: string; label: string }[];
  page: number;
  people: PageResult<DirectoryEmployee>;
  policyOptions: { value: string; label: string }[];
  position: string;
  search: string;
  setDepartment: (value: string) => void;
  setPage: (value: number | ((value: number) => number)) => void;
  setPosition: (value: string) => void;
  setSearch: (value: string) => void;
  setStatus: (value: string) => void;
  status: string;
}) {
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
                      <Avatar
                        sx={{
                          width: 34,
                          height: 34,
                          bgcolor: 'var(--color-success-soft)',
                          color: 'primary.dark',
                          fontSize: 'var(--text-caption)',
                        }}
                      >
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
              {
                name: 'endDate',
                label: 'Contract end',
                type: 'date',
                showWhen: { field: 'employmentType', values: ['CONTRACTUAL'] },
              },
              {
                name: 'probationEnd',
                label: 'Probation review',
                type: 'date',
                showWhen: { field: 'employmentType', values: ['PROBATIONARY'] },
              },
              { name: 'leavePolicyVersionId', label: 'Leave policy', options: policyOptions },
              { name: 'christmasPolicyVersionId', label: 'Christmas policy', options: christmasOptions },
            ]}
            onSubmit={onCreate}
          />
        </Card>
      )}
      {credentialDialog}
    </Stack>
  );
}

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ModalForm, Card, StatusTag, Tag, type Field } from './ui';
import AddBusinessOutlined from '@mui/icons-material/AddBusinessOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import Button from '@mui/material/Button';
import type { CurrentEmployee, DirectoryEmployee } from '@tms/contracts';
import Link from 'next/link';
import type { Department } from './organization-types';

export function OrganizationOverviewView({
  can,
  departments,
  employeeOptions,
  error,
  people,
  save,
  summary,
  user,
}: {
  can: (permission: CurrentEmployee['permissions'][number]) => boolean;
  departments: Department[];
  employeeOptions: { value: string; label: string }[];
  error: string;
  people: DirectoryEmployee[];
  save: (endpoint: string, values: Record<string, unknown>, method?: string) => Promise<void>;
  summary?: {
    totalEmployees: number;
    activeEmployees: number;
    suspendedEmployees: number;
    departments: number;
    boards: number;
  };
  user: CurrentEmployee;
}) {
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('asc');
  const visibleDepartments = departments
    .filter((department) => `${department.name} ${department.code}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  const reason: Field = { name: 'reason', label: 'Reason' };
  const leadership = people.filter((employee) => employee.position === 'SENIOR_DIRECTOR');
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <Card
        title="Departments and leadership"
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
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
                  {
                    name: 'taskManagementTypes',
                    label: 'Task management types',
                    value: 'KANBAN',
                    multiple: true,
                    checkboxes: true,
                    options: ['KANBAN', 'SCRUM', 'LIST'].map((value) => ({
                      value,
                      label: value[0] + value.slice(1).toLowerCase(),
                    })),
                  },
                  {
                    name: 'kanbanWipLimit',
                    label: 'Kanban: maximum in progress tasks per member',
                    type: 'number',
                    value: 3,
                    showWhen: { field: 'taskManagementTypes', values: ['KANBAN'] },
                  },
                ]}
                onSubmit={(values) =>
                  save('departments', {
                    ...values,
                    taskManagementTypes: String(values.taskManagementTypes).split(','),
                  })
                }
              />
            )}
            {user.position === 'SENIOR_DIRECTOR' && (
              <ModalForm
                buttonLabel="Governance"
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
        }
      >
        {summary && (
          <Box className="organization-metrics" sx={{ mb: 3 }}>
            {[
              ['Active people', summary.activeEmployees],
              ['Departments', summary.departments],
              ['Team boards', summary.boards],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography variant="h4" component="p">
                  {value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        {leadership.map((employee) => (
          <Box key={employee.id} className="leadership-banner">
            <Box className="leadership-avatar">{employee.displayName.slice(0, 1)}</Box>
            <Box>
              <Typography variant="overline">Organization leadership</Typography>
              <Typography variant="h6" component="p">
                {employee.displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Senior Director · Organization-wide oversight
              </Typography>
            </Box>
          </Box>
        ))}
        {!leadership.length && <Alert severity="warning">A Senior Director must be assigned.</Alert>}
      </Card>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Search departments"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          select
          label="Sort departments"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          sx={{ minWidth: 190 }}
        >
          <MenuItem value="asc">Name: A to Z</MenuItem>
          <MenuItem value="desc">Name: Z to A</MenuItem>
        </TextField>
      </Stack>
      <Box className="department-grid">
        {!visibleDepartments.length && <Typography>No departments match your search.</Typography>}
        {visibleDepartments.map((d) => (
          <Box component="section" key={d.id} aria-label={d.name} className="department-summary-card">
            <Typography component="h2" variant="h6">
              <Link href={`/departments/${d.id}`}>{d.name}</Link>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {d.code}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ my: 1, flexWrap: 'wrap' }}>
              <StatusTag value={d.status} />
              <Typography variant="body2">{people.filter((e) => e.department?.id === d.id).length} people</Typography>
              {d.taskManagementTypes?.map((type) => (
                <Tag key={type} value={type} tone="teal" />
              ))}
              <Tag value={`${d.workspace_department?._count.boards ?? 0} boards`} tone="blue" />
            </Stack>
            <Typography variant="body2" sx={{ my: 1 }}>
              Account Director:{' '}
              {people.find((person) => person.department?.id === d.id && person.position === 'ACCOUNT_DIRECTOR')
                ?.displayName ?? 'Not assigned'}
            </Typography>
            <details className="department-actions">
              <summary>Department actions</summary>
              {can('DEPARTMENT_UPDATE') && (
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
                  <ModalForm
                    buttonLabel="Edit department"
                    title={`Edit ${d.name}`}
                    fields={[
                      { name: 'name', label: 'Department name', value: d.name },
                      { name: 'description', label: 'Description', optional: true },
                      {
                        name: 'taskManagementTypes',
                        label: 'Task management types',
                        value: d.taskManagementTypes.join(','),
                        multiple: true,
                        checkboxes: true,
                        options: ['KANBAN', 'SCRUM', 'LIST'].map((value) => ({
                          value,
                          label: value[0] + value.slice(1).toLowerCase(),
                        })),
                      },
                      {
                        name: 'kanbanWipLimit',
                        label: 'Kanban: maximum in progress tasks per member',
                        showWhen: { field: 'taskManagementTypes', values: ['KANBAN'] },
                        type: 'number',
                        value: d.kanbanWipLimit,
                      },
                    ]}
                    onSubmit={(values) =>
                      save(
                        `departments/${d.id}`,
                        {
                          ...values,
                          taskManagementTypes: String(values.taskManagementTypes).split(','),
                          version: d.version,
                        },
                        'PATCH',
                      )
                    }
                  />
                  <ModalForm
                    buttonLabel={d.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    title={`${d.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${d.name}`}
                    description={
                      d.status === 'ACTIVE'
                        ? 'Deactivation is blocked until active employees and approval responsibilities are moved.'
                        : 'Activation makes this department available for employee assignments.'
                    }
                    submitLabel={d.status === 'ACTIVE' ? 'Deactivate department' : 'Activate department'}
                    fields={[]}
                    onSubmit={() =>
                      save(`departments/${d.id}/${d.status === 'ACTIVE' ? 'deactivate' : 'activate'}`, {})
                    }
                  />
                </Stack>
              )}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
                <Button component={Link} href={`/departments/${d.id}`}>
                  View department
                </Button>
                {can('DEPARTMENT_ASSIGN_ACCOUNT_DIRECTOR') && (
                  <ModalForm
                    buttonLabel="Assign director"
                    icon={<BadgeOutlined />}
                    title={`Assign Account Director to ${d.name}`}
                    fields={[
                      {
                        name: 'employeeId',
                        label: 'Eligible department member',
                        options: people
                          .filter((person) => person.department?.id === d.id && person.position !== 'SENIOR_DIRECTOR')
                          .map((person) => ({ value: person.id, label: person.displayName })),
                      },
                      reason,
                    ]}
                    onSubmit={(values) => save(`departments/${d.id}/director`, values)}
                  />
                )}
              </Stack>
            </details>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

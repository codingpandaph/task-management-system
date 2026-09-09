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
import { plainName } from './plain-language';

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
  const reason: Field = { name: 'reason', label: 'Reason' };
  const leadership = people.filter((employee) => employee.position === 'SENIOR_DIRECTOR');
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {summary && (
        <div className="stat-grid">
          {[
            ['Employees', summary.totalEmployees],
            ['Active', summary.activeEmployees],
            ['Suspended', summary.suspendedEmployees],
            ['Departments', summary.departments],
            ['Boards', summary.boards],
          ].map(([label, value]) => (
            <Card key={label} title={String(value)}>
              <Typography color="text.secondary">{label}</Typography>
            </Card>
          ))}
        </div>
      )}
      <Card
        title="Organization structure"
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
                    options: ['KANBAN', 'SCRUM', 'LIST'].map((value) => ({
                      value,
                      label: value[0] + value.slice(1).toLowerCase(),
                    })),
                  },
                  { name: 'kanbanWipLimit', label: 'Maximum in progress tasks per member', type: 'number', value: 3 },
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
        {leadership.map((employee) => (
          <Stack key={employee.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700 }}>{employee.displayName}</Typography>
            <Tag value="Senior" tone="purple" />
            <Tag value="Organization-wide" tone="teal" />
          </Stack>
        ))}
        {!leadership.length && <Alert severity="warning">A Senior Director must be assigned.</Alert>}
      </Card>
      <div className="grid-two">
        {departments.map((d) => (
          <Card key={d.id} title={d.name}>
            <Tag value={d.code} tone="teal" />
            <Stack direction="row" spacing={1} sx={{ my: 2 }}>
              <StatusTag value={d.status} />
              <Tag value={`${people.filter((e) => e.department?.id === d.id).length} people`} />
              {d.taskManagementTypes?.map((type) => (
                <Tag key={type} value={type} tone="teal" />
              ))}
              <Tag value={`${d.workspace_department?._count.boards ?? 0} boards`} tone="blue" />
            </Stack>
            {people
              .filter((e) => e.department?.id === d.id)
              .map((e) => (
                <Typography key={e.id}>
                  {e.displayName} · {plainName(e.position)}
                </Typography>
              ))}
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
                      options: ['KANBAN', 'SCRUM', 'LIST'].map((value) => ({
                        value,
                        label: value[0] + value.slice(1).toLowerCase(),
                      })),
                    },
                    {
                      name: 'kanbanWipLimit',
                      label: 'Maximum in progress tasks per member',
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
                  onSubmit={() => save(`departments/${d.id}/${d.status === 'ACTIVE' ? 'deactivate' : 'activate'}`, {})}
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
          </Card>
        ))}
      </div>
    </Stack>
  );
}

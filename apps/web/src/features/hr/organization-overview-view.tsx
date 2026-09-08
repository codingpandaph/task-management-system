import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ModalForm, Card, StatusTag, Tag, type Field } from './ui';
import AddBusinessOutlined from '@mui/icons-material/AddBusinessOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import type { CurrentEmployee, DirectoryEmployee } from '@tms/contracts';
import type { Department } from './organization-types';

export function OrganizationOverviewView({
  can,
  departments,
  employeeOptions,
  error,
  options,
  people,
  save,
  user,
}: {
  can: (permission: CurrentEmployee['permissions'][number]) => boolean;
  departments: Department[];
  employeeOptions: { value: string; label: string }[];
  error: string;
  options: { value: string; label: string }[];
  people: DirectoryEmployee[];
  save: (endpoint: string, values: Record<string, string | number>, method?: string) => Promise<void>;
  user: CurrentEmployee;
}) {
  const reason: Field = { name: 'reason', label: 'Reason' };
  const leadership = people.filter((employee) => employee.position === 'SENIOR_DIRECTOR');
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <Card title="Executive leadership">
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
            </Stack>
            {people
              .filter((e) => e.department?.id === d.id)
              .map((e) => (
                <Typography key={e.id}>
                  {e.displayName} · {e.position.replaceAll('_', ' ')}
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
                  ]}
                  onSubmit={(v) => save(`departments/${d.id}`, { ...v, version: d.version }, 'PATCH')}
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
}

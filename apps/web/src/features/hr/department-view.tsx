'use client';
/* eslint-disable max-lines -- This screen keeps each team's leadership, settings, access, and board summary together. */
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee, TaskManagementType } from '@tms/contracts';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, LoadingState, message, ModalForm, Tag } from './ui';
import type { DepartmentDetail, Team } from './organization-types';
import { plainName } from './plain-language';

const workflowTypes: TaskManagementType[] = ['KANBAN', 'SCRUM', 'LIST'];

function TeamSection({
  team,
  user,
  departmentId,
  refresh,
}: {
  team: Team;
  user: CurrentEmployee;
  departmentId: string;
  refresh: () => Promise<void>;
}) {
  const [types, setTypes] = useState(team.taskManagementTypes);
  const [limit, setLimit] = useState(team.kanbanWipLimit);
  const [error, setError] = useState('');
  const people = team.employees ?? [];
  const director = people.find((person) => person.position === 'ACCOUNT_DIRECTOR');
  const departmentManager =
    user.position === 'MANAGING_DIRECTOR' ||
    (user.position === 'SENIOR_DIRECTOR' && user.department?.id === departmentId) ||
    user.permissions.includes('DEPARTMENT_UPDATE');
  const teamManager = departmentManager || (user.position === 'ACCOUNT_DIRECTOR' && user.team?.id === team.id);

  async function saveSettings() {
    try {
      await api(
        `teams/${team.id}`,
        { code: team.code, name: team.name, taskManagementTypes: types, kanbanWipLimit: limit, version: team.version },
        'PATCH',
      );
      await refresh();
    } catch (cause) {
      setError(message(cause));
    }
  }

  async function permission(employeeId: string, key: 'canCreateTasks' | 'canCreateBoards', value: boolean) {
    if (!team.workspace) return;
    const current = team.workspace.memberships.find((item) => item.employeeId === employeeId);
    try {
      await api(`task-workspaces/${team.workspace.id}/memberships`, {
        employeeId,
        canCreateTasks: key === 'canCreateTasks' ? value : !!current?.canCreateTasks,
        canCreateBoards: key === 'canCreateBoards' ? value : !!current?.canCreateBoards,
      });
      await refresh();
    } catch (cause) {
      setError(message(cause));
    }
  }

  return (
    <Paper component="section" aria-label={team.name} className="team-panel" variant="outlined">
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
          <div>
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="h5">{team.name}</Typography>
              <Tag value={team.code} tone="blue" />
              <Tag value={team.status} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {director?.displayName ?? 'Account Director not assigned'} ·{' '}
              {people.filter((p) => p.position === 'MEMBER').length} members
            </Typography>
          </div>
          {departmentManager && (
            <ModalForm
              buttonLabel={director ? 'Change Account Director' : 'Assign Account Director'}
              title={`Account Director for ${team.name}`}
              description="The Account Director leads this team and approves member leave before the Senior Director and HR."
              fields={[
                {
                  name: 'employeeId',
                  label: 'Team member',
                  options: people
                    .filter((person) => person.position === 'MEMBER')
                    .map((person) => ({ value: person.id, label: person.displayName })),
                },
                { name: 'reason', label: 'Reason' },
              ]}
              submitLabel="Assign Account Director"
              onSubmit={async (values) => {
                await api(`teams/${team.id}/director`, values);
                await refresh();
              }}
            />
          )}
        </Stack>

        {teamManager && (
          <div>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Board settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              These settings apply only to {team.name}.
            </Typography>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              useFlexGap
              sx={{ alignItems: { md: 'center' }, flexWrap: 'wrap' }}
            >
              <FormControlLabel
                label="Select all"
                control={
                  <Checkbox
                    checked={types.length === workflowTypes.length}
                    indeterminate={types.length > 0 && types.length < workflowTypes.length}
                    onChange={(event) => setTypes(event.target.checked ? workflowTypes : [])}
                  />
                }
              />
              {workflowTypes.map((type) => (
                <FormControlLabel
                  key={type}
                  label={plainName(type)}
                  control={
                    <Checkbox
                      checked={types.includes(type)}
                      onChange={(event) =>
                        setTypes((current) =>
                          event.target.checked ? [...current, type] : current.filter((item) => item !== type),
                        )
                      }
                    />
                  }
                />
              ))}
              {types.includes('KANBAN') && (
                <TextField
                  label="Maximum in progress tasks per member"
                  type="number"
                  size="small"
                  value={limit}
                  onChange={(event) => setLimit(Number(event.target.value))}
                  slotProps={{ htmlInput: { min: 1, max: 50 } }}
                />
              )}
              <Button variant="contained" disabled={!types.length} onClick={() => void saveSettings()}>
                Save settings
              </Button>
            </Stack>
          </div>
        )}

        <Divider />
        <Stack spacing={1}>
          {people.map((person) => {
            const access = team.workspace?.memberships.find((item) => item.employeeId === person.id);
            return (
              <Stack
                key={person.id}
                className="team-member-row"
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
              >
                <div>
                  <Typography sx={{ fontWeight: 750 }}>{person.displayName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {plainName(person.position)} · {person.employeeId}
                  </Typography>
                </div>
                {teamManager && person.position === 'MEMBER' && team.workspace && (
                  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <FormControlLabel
                      label="Create boards"
                      control={
                        <Switch
                          checked={!!access?.canCreateBoards}
                          slotProps={{ input: { 'aria-label': `Create boards for ${person.displayName}` } }}
                          onChange={(event) => void permission(person.id, 'canCreateBoards', event.target.checked)}
                        />
                      }
                    />
                    <FormControlLabel
                      label="Create tasks"
                      control={
                        <Switch
                          checked={!!access?.canCreateTasks}
                          slotProps={{ input: { 'aria-label': `Create tasks for ${person.displayName}` } }}
                          onChange={(event) => void permission(person.id, 'canCreateTasks', event.target.checked)}
                        />
                      }
                    />
                  </Stack>
                )}
              </Stack>
            );
          })}
        </Stack>

        <Divider />
        <div>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
            Team boards
          </Typography>
          {!team.workspace && <Alert severity="info">This team does not have a workspace yet.</Alert>}
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {team.workspace?.boards.map((board) => (
              <Tag key={board.id} value={`${board.name} · ${plainName(board.kind)}`} tone="teal" />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Every team member can comment and move tickets. Creating tickets and boards depends on the permissions
            above.
          </Typography>
        </div>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Paper>
  );
}

export function DepartmentView({ user, departmentId }: { user: CurrentEmployee; departmentId?: string }) {
  const id = departmentId ?? user.department?.id;
  const [department, setDepartment] = useState<DepartmentDetail>();
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!id) return;
    setDepartment(await api<DepartmentDetail>(`departments/${id}`));
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((cause) => setError(message(cause))));
  }, [load]);
  if (!id) return <Alert severity="info">Choose a department from the organization view.</Alert>;
  if (!department) return error ? <Alert severity="error">{error}</Alert> : <LoadingState label="Loading department" />;
  const senior = department.employee_department.find((person) => person.position === 'SENIOR_DIRECTOR');
  const canCreateTeam =
    user.position === 'MANAGING_DIRECTOR' ||
    (user.position === 'SENIOR_DIRECTOR' && user.department?.id === department.id) ||
    user.permissions.includes('DEPARTMENT_UPDATE');

  return (
    <Stack spacing={3}>
      <Card
        title={department.name}
        actions={
          canCreateTeam ? (
            <ModalForm
              buttonLabel="Create team"
              title={`Create a team in ${department.name}`}
              description="A team gets its own members, Account Director, board settings, and workspace."
              variant="contained"
              fields={[
                { name: 'code', label: 'Team code' },
                { name: 'name', label: 'Team name' },
                {
                  name: 'taskManagementTypes',
                  label: 'Task management types',
                  value: 'KANBAN',
                  multiple: true,
                  checkboxes: true,
                  options: workflowTypes.map((value) => ({ value, label: plainName(value) })),
                },
                {
                  name: 'kanbanWipLimit',
                  label: 'Kanban: maximum in progress tasks per member',
                  type: 'number',
                  value: 3,
                  showWhen: { field: 'taskManagementTypes', values: ['KANBAN'] },
                },
              ]}
              submitLabel="Create team"
              onSubmit={async (values) => {
                await api(`departments/${department.id}/teams`, {
                  ...values,
                  taskManagementTypes: String(values.taskManagementTypes).split(','),
                });
                await load();
              }}
            />
          ) : undefined
        }
      >
        <Typography color="text.secondary">
          {department.code} · {department.teams.length} {department.teams.length === 1 ? 'team' : 'teams'} ·{' '}
          {department.employee_department.filter((person) => person.position === 'MEMBER').length} members
        </Typography>
        <Typography sx={{ mt: 1 }}>
          <strong>Senior Director:</strong> {senior?.displayName ?? 'Not assigned'}
        </Typography>
      </Card>
      {department.teams.map((team) => (
        <TeamSection key={team.id} team={team} user={user} departmentId={department.id} refresh={load} />
      ))}
      {!department.teams.length && (
        <Alert severity="warning">Create the first team before assigning members or boards.</Alert>
      )}
    </Stack>
  );
}

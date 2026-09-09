'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee, TaskManagementType } from '@tms/contracts';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, LoadingState, message, Tag } from './ui';
import type { DepartmentDetail } from './organization-types';

const workflowTypes: TaskManagementType[] = ['KANBAN', 'SCRUM', 'LIST'];

export function DepartmentView({ user, departmentId }: { user: CurrentEmployee; departmentId?: string }) {
  const id = departmentId ?? user.department?.id;
  const [department, setDepartment] = useState<DepartmentDetail>();
  const [types, setTypes] = useState<TaskManagementType[]>([]);
  const [limit, setLimit] = useState(3);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!id) return;
    const value = await api<DepartmentDetail>(`departments/${id}`);
    setDepartment(value);
    setTypes(value.taskManagementTypes);
    setLimit(value.kanbanWipLimit);
  }, [id]);
  useEffect(() => {
    queueMicrotask(() => void load().catch((cause) => setError(message(cause))));
  }, [load]);
  if (!id)
    return (
      <Alert severity="info">The Senior Director works across the organization rather than in one department.</Alert>
    );
  if (!department) return error ? <Alert severity="error">{error}</Alert> : <LoadingState label="Loading department" />;
  const selectedDepartment = department;
  const manager =
    user.position === 'SENIOR_DIRECTOR' ||
    (user.position === 'ACCOUNT_DIRECTOR' && user.department?.id === department.id) ||
    user.permissions.includes('DEPARTMENT_UPDATE');
  const workspace = department.workspace_department;
  const director = department.employee_department.find((person) => person.position === 'ACCOUNT_DIRECTOR');
  async function saveSettings() {
    setError('');
    try {
      await api(
        `departments/${selectedDepartment.id}/task-settings`,
        {
          taskManagementTypes: types,
          kanbanWipLimit: limit,
          version: selectedDepartment.version,
        },
        'PATCH',
      );
      await load();
    } catch (cause) {
      setError(message(cause));
    }
  }
  async function permission(employeeId: string, key: 'canCreateTasks' | 'canCreateBoards', value: boolean) {
    if (!workspace) return;
    const current = workspace.memberships.find((item) => item.employeeId === employeeId);
    await api(`task-workspaces/${workspace.id}/memberships`, {
      employeeId,
      canCreateTasks: key === 'canCreateTasks' ? value : !!current?.canCreateTasks,
      canCreateBoards: key === 'canCreateBoards' ? value : !!current?.canCreateBoards,
    });
    await load();
  }
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <Card
        title={department.name}
        actions={
          <Stack direction="row" spacing={1}>
            {types.map((type) => (
              <Tag key={type} value={type} tone="teal" />
            ))}
          </Stack>
        }
      >
        <Typography color="text.secondary">
          {department.code} · {department.employee_department.length} active members
        </Typography>
        <Typography sx={{ mt: 1 }}>
          <strong>Account Director:</strong> {director?.displayName ?? 'Not assigned'}
        </Typography>
      </Card>
      {manager && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6">Task workflow settings</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Choose the board styles available to this department.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            useFlexGap
            sx={{ alignItems: { sm: 'center' }, flexWrap: 'wrap' }}
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
                label={type[0] + type.slice(1).toLowerCase()}
              />
            ))}
            {types.includes('KANBAN') && (
              <TextField
                label="Maximum in progress tasks per member"
                type="number"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                slotProps={{ htmlInput: { min: 1, max: 50 } }}
              />
            )}
            <Button variant="contained" disabled={!types.length} onClick={() => void saveSettings()}>
              Save settings
            </Button>
          </Stack>
        </Paper>
      )}
      <Card title="Department members">
        <Stack spacing={1}>
          {department.employee_department.map((person) => {
            const access = workspace?.memberships.find((item) => item.employeeId === person.id);
            return (
              <Paper key={person.id} variant="outlined" sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
                >
                  <div>
                    <Typography sx={{ fontWeight: 800 }}>{person.displayName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {person.employeeId} · {person.position === 'ACCOUNT_DIRECTOR' ? 'Account Director' : 'Member'}
                    </Typography>
                  </div>
                  {manager && person.position === 'MEMBER' && workspace && (
                    <Stack direction="row" spacing={1}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!access?.canCreateBoards}
                            slotProps={{ input: { 'aria-label': `Create boards for ${person.displayName}` } }}
                            onChange={(event) => void permission(person.id, 'canCreateBoards', event.target.checked)}
                          />
                        }
                        label="Create boards"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={!!access?.canCreateTasks}
                            slotProps={{ input: { 'aria-label': `Create tasks for ${person.displayName}` } }}
                            onChange={(event) => void permission(person.id, 'canCreateTasks', event.target.checked)}
                          />
                        }
                        label="Create tasks"
                      />
                    </Stack>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Card>
      <Card title="Boards">
        <Stack spacing={1}>
          {workspace?.boards.map((board) => (
            <Paper key={board.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 800 }}>{board.name}</Typography>
                <Tag value={board.kind} tone="blue" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Created by {board.creator.firstName} {board.creator.lastName} · Open to all department members
              </Typography>
            </Paper>
          )) ?? <Typography color="text.secondary">No workspace has been created yet.</Typography>}
        </Stack>
      </Card>
    </Stack>
  );
}

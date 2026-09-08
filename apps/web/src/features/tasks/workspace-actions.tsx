import Box from '@mui/material/Box';
import type { CurrentEmployee, DirectoryEmployee } from '@tms/contracts';
import { api } from '@/lib/api';
import { ModalForm } from '../hr/ui';
import type { Workspace } from './task-types';

export function WorkspaceActions({
  workspace,
  user,
  people,
  refresh,
}: {
  workspace: Workspace;
  user: CurrentEmployee;
  people: DirectoryEmployee[];
  refresh: () => Promise<void>;
}) {
  const manager =
    user.position === 'SENIOR_DIRECTOR' ||
    (user.position === 'ACCOUNT_DIRECTOR' && user.department.id === workspace.departmentId);
  const canCreateBoards = manager || workspace.memberships.some((membership) => membership.canCreateBoards);
  if (!canCreateBoards) return null;
  return (
    <Box className="workspace-actions">
      {manager && (
        <ModalForm
          buttonLabel="New milestone"
          title="Create milestone"
          fields={[
            { name: 'name', label: 'Milestone name' },
            { name: 'goal', label: 'Goal' },
            { name: 'startDate', label: 'Start date', type: 'date' },
            { name: 'dueDate', label: 'Due date and time', type: 'datetime-local' },
          ]}
          onSubmit={async (values) => {
            await api(`task-workspaces/${workspace.id}/milestones`, values);
            await refresh();
          }}
        />
      )}
      <ModalForm
        buttonLabel="New board"
        title="Create Kanban board"
        description="Creates a clear To do, In progress, Review, and management-locked Done workflow."
        fields={[{ name: 'name', label: 'Board name' }]}
        onSubmit={async (values) => {
          await api(`task-workspaces/${workspace.id}/boards`, {
            name: values.name,
            kind: 'KANBAN',
            columns: [
              { name: 'To do' },
              { name: 'In progress' },
              { name: 'Review' },
              { name: 'Done', isDone: true, managementLocked: true },
            ],
          });
          await refresh();
        }}
      />
      {manager && (
        <ModalForm
          buttonLabel="Add collaborator"
          title="Add workspace collaborator"
          fields={[
            {
              name: 'employeeId',
              label: 'Active employee',
              options: people.map((employee) => ({ value: employee.id, label: employee.displayName })),
            },
            {
              name: 'milestoneId',
              label: 'Milestone scope',
              optional: true,
              options: [
                { value: '', label: 'Entire workspace' },
                ...workspace.milestones.map((milestone) => ({ value: milestone.id, label: milestone.name })),
              ],
            },
            {
              name: 'canCreateTasks',
              label: 'Can create tickets',
              value: 'true',
              options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ],
            },
            {
              name: 'canCreateBoards',
              label: 'Can create boards',
              value: 'false',
              options: [
                { value: 'false', label: 'No' },
                { value: 'true', label: 'Yes' },
              ],
            },
          ]}
          onSubmit={async (values) => {
            await api(`task-workspaces/${workspace.id}/memberships`, {
              ...values,
              canCreateTasks: values.canCreateTasks === 'true',
              canCreateBoards: values.canCreateBoards === 'true',
            });
            await refresh();
          }}
        />
      )}
    </Box>
  );
}

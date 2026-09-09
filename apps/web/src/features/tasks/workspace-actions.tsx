import Box from '@mui/material/Box';
import type { CurrentEmployee, DirectoryEmployee } from '@tms/contracts';
import { api } from '@/lib/api';
import { ModalForm } from '../hr/ui';
import type { Board, Workspace } from './task-types';

export function WorkspaceActions({
  workspace,
  user,
  people,
  board,
  refresh,
}: {
  workspace: Workspace;
  user: CurrentEmployee;
  people: DirectoryEmployee[];
  board?: Board;
  refresh: () => Promise<void>;
}) {
  const manager =
    user.position === 'SENIOR_DIRECTOR' ||
    (user.position === 'ACCOUNT_DIRECTOR' && user.department?.id === workspace.departmentId);
  const boardManager = manager || board?.creator.id === user.id;
  const canCreateBoards =
    manager ||
    workspace.memberships.some((membership) => membership.employeeId === user.id && membership.canCreateBoards);
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
        title="Create board"
        description="The workflow is created from the board type selected for this department."
        fields={[
          { name: 'name', label: 'Board name' },
          {
            name: 'kind',
            label: 'Board type',
            value: workspace.department.taskManagementTypes[0],
            options: workspace.department.taskManagementTypes.map((kind) => ({
              value: kind,
              label: kind[0] + kind.slice(1).toLowerCase(),
            })),
          },
        ]}
        onSubmit={async (values) => {
          await api(`task-workspaces/${workspace.id}/boards`, {
            name: values.name,
            kind: values.kind,
          });
          await refresh();
        }}
      />
      {boardManager && board && (
        <ModalForm
          buttonLabel="Add collaborator"
          title={`Add a collaborator to ${board.name}`}
          fields={[
            {
              name: 'employeeId',
              label: 'Active employee',
              options: people
                .filter((employee) => employee.department?.id === workspace.departmentId)
                .map((employee) => ({ value: employee.id, label: employee.displayName })),
            },
          ]}
          onSubmit={async (values) => {
            await api(`task-boards/${board.id}/collaborators`, values);
            await refresh();
          }}
        />
      )}
      {boardManager && board?.kind === 'SCRUM' && (
        <ModalForm
          buttonLabel="New sprint"
          title="Create sprint"
          fields={[
            { name: 'name', label: 'Sprint name' },
            { name: 'goal', label: 'Sprint goal' },
            { name: 'startDate', label: 'Start date', type: 'date' },
            { name: 'endDate', label: 'End date', type: 'date' },
          ]}
          onSubmit={async (values) => {
            await api(`task-boards/${board.id}/sprints`, values);
            await refresh();
          }}
        />
      )}
    </Box>
  );
}

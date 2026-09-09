import Box from '@mui/material/Box';
import type { CurrentEmployee } from '@tms/contracts';
import { api } from '@/lib/api';
import { ModalForm } from '../hr/ui';
import type { Board, Workspace } from './task-types';

export function WorkspaceActions({
  workspace,
  user,
  board,
  refresh,
}: {
  workspace: Workspace;
  user: CurrentEmployee;
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
  if (!canCreateBoards && !boardManager) return null;
  return (
    <Box className="workspace-actions">
      {canCreateBoards && (
        <ModalForm
          buttonLabel="New board"
          title="Create board"
          description="Choose the workflow. A Scrum board is created with one milestone and calendar dates."
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
            { name: 'milestoneName', label: 'Milestone name', showWhen: { field: 'kind', values: ['SCRUM'] } },
            { name: 'milestoneGoal', label: 'Milestone goal', showWhen: { field: 'kind', values: ['SCRUM'] } },
            {
              name: 'milestoneStartDate',
              label: 'Milestone start date',
              type: 'date',
              showWhen: { field: 'kind', values: ['SCRUM'] },
            },
            {
              name: 'milestoneDueDate',
              label: 'Milestone due date',
              type: 'date',
              showWhen: { field: 'kind', values: ['SCRUM'] },
            },
          ]}
          onSubmit={async (values) => {
            await api(`task-workspaces/${workspace.id}/boards`, {
              name: values.name,
              kind: values.kind,
              milestoneName: values.milestoneName,
              milestoneGoal: values.milestoneGoal,
              milestoneStartDate: values.milestoneStartDate,
              milestoneDueDate: values.milestoneDueDate,
            });
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

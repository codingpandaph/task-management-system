import type { CurrentEmployee } from '@tms/contracts';
import { BoardCreateDialog } from './board-create-dialog';
import type { Workspace } from './task-types';

export function WorkspaceActions({
  workspace,
  user,
  refresh,
}: {
  workspace: Workspace;
  user: CurrentEmployee;
  refresh: () => Promise<void>;
}) {
  const manager =
    user.position === 'MANAGING_DIRECTOR' ||
    (user.position === 'SENIOR_DIRECTOR' && user.department?.id === workspace.departmentId) ||
    (user.position === 'ACCOUNT_DIRECTOR' && user.team?.id === workspace.teamId);
  const canCreateBoards =
    manager ||
    workspace.memberships.some((membership) => membership.employeeId === user.id && membership.canCreateBoards);
  if (!canCreateBoards) return null;
  return <BoardCreateDialog workspace={workspace} refresh={refresh} />;
}

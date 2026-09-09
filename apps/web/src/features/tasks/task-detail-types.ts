import type { CurrentEmployee, DirectoryEmployee, TaskColumnContract, TaskContract } from '@tms/contracts';

export interface TaskDetailProps {
  taskId: string;
  user: CurrentEmployee;
  columns?: TaskColumnContract[];
  onClose: () => void;
  refresh: () => Promise<void>;
  people: DirectoryEmployee[];
  readOnly?: boolean;
}

export type TaskDetailResponse = TaskContract & {
  board: {
    id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE';
    columns: Omit<TaskColumnContract, 'tasks'>[];
  };
  comments: { id: string; body: string; author: { firstName: string; lastName: string } }[];
  attachments: { id: string; name: string; url: string; mediaType: string; sizeBytes: number }[];
  mentions: { id: string; employee: { id: string; employeeId: string; firstName: string; lastName: string } }[];
  activity: {
    id: string;
    actionType: string;
    fieldChanged: string | null;
    oldValue: string | null;
    newValue: string | null;
    createdAt: string;
    actor: { firstName: string; lastName: string };
  }[];
};

export function canManageTask(user: CurrentEmployee, task: TaskDetailResponse) {
  return (
    user.position === 'SENIOR_DIRECTOR' ||
    (user.position === 'ACCOUNT_DIRECTOR' && user.department?.id === task.workspace.departmentId)
  );
}

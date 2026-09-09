import type {
  CurrentEmployee,
  DirectoryEmployee,
  SprintStatus,
  TaskColumnContract,
  TaskContract,
} from '@tms/contracts';

export interface TaskDetailProps {
  taskId: string;
  user: CurrentEmployee;
  columns?: TaskColumnContract[];
  onClose: () => void;
  refresh: () => Promise<void>;
  people: DirectoryEmployee[];
}

export type TaskDetailResponse = TaskContract & {
  board: {
    id: string;
    name: string;
    columns: Omit<TaskColumnContract, 'tasks'>[];
    sprints: { id: string; name: string; status: SprintStatus }[];
  };
  comments: { id: string; body: string; author: { firstName: string; lastName: string } }[];
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

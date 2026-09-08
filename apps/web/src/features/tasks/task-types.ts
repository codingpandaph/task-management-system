import type { TaskColumnContract, TaskContract } from '@tms/contracts';

export type Board = { id: string; name: string; kind: string; columns: TaskColumnContract[] };
export type Milestone = { id: string; name: string; goal: string; dueDate: string; isOvercapacity: boolean };
export type Workspace = {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  function: string;
  boards: Board[];
  milestones: Milestone[];
  memberships: { employeeId: string; canCreateTasks: boolean; canCreateBoards: boolean }[];
};
export type BoardResponse = { workspace: Workspace; board: Board };
export type TaskReport = {
  id: string;
  code: string;
  name: string;
  total: number;
  completed: number;
  unassigned: number;
  escalated: number;
  estimatedHours: number;
  openMilestones: number;
};
export type DepartmentOption = { id: string; name: string; code: string; status: string };
export const priorityTone = { LOW: 'grey', MEDIUM: 'blue', HIGH: 'red' } as const;
export type TaskDetailContract = TaskContract & {
  incomingLinks: { id: string; sourceTask: Pick<TaskContract, 'id' | 'publicKey' | 'title'> }[];
};

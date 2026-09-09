import type { SprintStatus, TaskColumnContract, TaskContract, TaskManagementType, TaskPerson } from '@tms/contracts';

export type Sprint = {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
};
export type Board = {
  id: string;
  name: string;
  kind: TaskManagementType;
  columns: TaskColumnContract[];
  creator: TaskPerson;
  collaborators: { employeeId: string; employee: TaskPerson }[];
  sprints: Sprint[];
};
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
  department: {
    id: string;
    name: string;
    taskManagementTypes: TaskManagementType[];
    kanbanWipLimit: number;
  };
};
export type BoardResponse = {
  workspace: Workspace;
  board: Board;
  wip: (TaskPerson & { used: number; limit: number })[];
};
export type TaskReport = {
  id: string;
  code: string;
  name: string;
  total: number;
  completed: number;
  unassigned: number;
  escalated: number;
  blocked: number;
  inProgress: number;
  inReview: number;
  estimatedHours: number;
  openMilestones: number;
  capacityRisks: number;
  memberLoad: { id: string; name: string; tasks: number; hours: number }[];
};
export type DepartmentOption = { id: string; name: string; code: string; status: string };
export const priorityTone = { LOW: 'grey', MEDIUM: 'blue', HIGH: 'red' } as const;
export type TaskDetailContract = TaskContract & {
  incomingLinks: { id: string; sourceTask: Pick<TaskContract, 'id' | 'publicKey' | 'title'> }[];
};

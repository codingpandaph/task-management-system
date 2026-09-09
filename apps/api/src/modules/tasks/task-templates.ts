import type { TaskManagementType, WorkspaceFunction } from '../../generated/prisma/client';

type Template = { name: string; kind: TaskManagementType; columns: [string, boolean, boolean][] };
const kanban: Template['columns'] = [
  ['To do', false, false],
  ['In progress', false, false],
  ['Review', false, false],
  ['Done', true, true],
];
const list: Template['columns'] = [
  ['Open', false, false],
  ['Done', true, false],
];

export const workspaceTemplates: Record<WorkspaceFunction, Template[]> = {
  ENGINEERING_PRODUCT: [
    { name: 'Engineering delivery', kind: 'KANBAN', columns: kanban },
    { name: 'Request list', kind: 'LIST', columns: list },
  ],
  MARKETING_CREATIVE: [{ name: 'Campaign delivery', kind: 'KANBAN', columns: kanban }],
  SALES_ACCOUNT_MANAGEMENT: [{ name: 'Client delivery', kind: 'KANBAN', columns: kanban }],
  HR_OPERATIONS: [{ name: 'People operations', kind: 'LIST', columns: list }],
  FINANCE_LEGAL: [{ name: 'Request list', kind: 'LIST', columns: list }],
};

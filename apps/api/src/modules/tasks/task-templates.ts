import type { WorkspaceFunction } from '../../generated/prisma/client';

export const workspaceTemplates: Record<
  WorkspaceFunction,
  { name: string; kind: string; columns: [string, boolean, boolean][] }[]
> = {
  ENGINEERING_PRODUCT: [
    {
      name: 'Backlog',
      kind: 'BACKLOG',
      columns: [
        ['To do', false, false],
        ['Ready', false, false],
        ['Done', true, true],
      ],
    },
    {
      name: 'Scrum milestones',
      kind: 'SCRUM',
      columns: [
        ['To do', false, false],
        ['In progress', false, false],
        ['Review', false, false],
        ['Done', true, true],
      ],
    },
    {
      name: 'Features',
      kind: 'KANBAN',
      columns: [
        ['To do', false, false],
        ['Building', false, false],
        ['Approved', true, true],
      ],
    },
  ],
  MARKETING_CREATIVE: [
    {
      name: 'Campaign calendar',
      kind: 'CALENDAR',
      columns: [
        ['Planned', false, false],
        ['Scheduled', false, false],
        ['Published', true, true],
      ],
    },
    {
      name: 'Editorial',
      kind: 'KANBAN',
      columns: [
        ['To do', false, false],
        ['Creating', false, false],
        ['Review', false, false],
        ['Done', true, true],
      ],
    },
    {
      name: 'Asset pipeline',
      kind: 'PIPELINE',
      columns: [
        ['Requested', false, false],
        ['Designing', false, false],
        ['Approved', true, true],
      ],
    },
  ],
  SALES_ACCOUNT_MANAGEMENT: [
    {
      name: 'CRM funnel',
      kind: 'FUNNEL',
      columns: [
        ['Lead', false, false],
        ['Qualified', false, false],
        ['Proposal', false, false],
        ['Won', true, true],
      ],
    },
    {
      name: 'Lead tracker',
      kind: 'TRACKER',
      columns: [
        ['New', false, false],
        ['Contacted', false, false],
        ['Converted', true, true],
      ],
    },
  ],
  HR_OPERATIONS: [
    {
      name: 'Recruitment',
      kind: 'FUNNEL',
      columns: [
        ['Applied', false, false],
        ['Interview', false, false],
        ['Offer', false, true],
        ['Hired', true, true],
      ],
    },
    {
      name: 'People journey',
      kind: 'CHECKLIST',
      columns: [
        ['To do', false, false],
        ['In progress', false, false],
        ['Done', true, true],
      ],
    },
  ],
  FINANCE_LEGAL: [
    {
      name: 'Request intake',
      kind: 'QUEUE',
      columns: [
        ['To do', false, false],
        ['Review', false, false],
        ['Approved', true, true],
      ],
    },
    {
      name: 'Audit tracker',
      kind: 'TRACKER',
      columns: [
        ['Open', false, false],
        ['Evidence', false, false],
        ['Closed', true, true],
      ],
    },
  ],
};

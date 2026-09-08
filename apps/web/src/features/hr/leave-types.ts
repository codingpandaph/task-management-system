import type { Field } from './ui';

export interface RequestRow {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  workingDays: number;
  employee?: { id: string; firstName: string; lastName: string };
}
export interface Step {
  id: string;
  sequence: number;
  type: string;
  approverId: string;
  status: string;
  eligible?: boolean;
  reason?: string;
}
export interface LeaveDetail extends RequestRow {
  employeeId: string;
  reason?: string;
  steps: Step[];
  cancellations: { id: string; status: string; steps: Step[] }[];
}
export interface LeaveInbox {
  steps: (Step & {
    request: {
      id: string;
      status: string;
      startDate: string;
      endDate: string;
      employee: { firstName: string; lastName: string };
    };
  })[];
  cancellations: (Step & {
    cancellation: {
      id: string;
      requestId: string;
      status: string;
      reason: string;
      request: {
        startDate: string;
        endDate: string;
        employee: { firstName: string; lastName: string };
      };
    };
  })[];
}
export const leaveFields: Field[] = [
  {
    name: 'type',
    label: 'Leave type',
    options: [
      { value: 'VACATION', label: 'Vacation' },
      { value: 'SICK', label: 'Sick leave' },
      { value: 'CHRISTMAS_VACATION', label: 'Christmas Vacation' },
    ],
  },
  { name: 'startDate', label: 'Start date', type: 'date' },
  { name: 'endDate', label: 'End date', type: 'date' },
  { name: 'reason', label: 'Reason (optional; no medical diagnosis)', optional: true },
];

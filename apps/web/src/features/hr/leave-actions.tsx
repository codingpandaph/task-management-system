import AddOutlined from '@mui/icons-material/AddOutlined';
import EditCalendarOutlined from '@mui/icons-material/EditCalendarOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import Stack from '@mui/material/Stack';
import { api } from '@/lib/api';
import { leaveFields } from './leave-types';
import { ModalForm } from './ui';

export function LeaveActions({
  hrMode,
  employeeOptions,
  reload,
}: {
  hrMode: boolean;
  employeeOptions: { value: string; label: string }[];
  reload: () => void;
}) {
  if (!hrMode)
    return (
      <ModalForm
        buttonLabel="File leave"
        icon={<EditCalendarOutlined />}
        title="File a leave request"
        description="Review the dates and action carefully. Pending requests reserve your allowance."
        variant="contained"
        fields={leaveFields}
        actions={[
          { label: 'Preview days', value: 'preview', variant: 'text' },
          { label: 'Save draft', value: 'draft', variant: 'outlined' },
          { label: 'Submit for approval', value: 'submit', variant: 'contained' },
        ]}
        onSubmit={async ({ action, ...values }) => {
          if (action === 'preview') {
            const result = await api<{ workingDays: number }>('leave/preview', values);
            return {
              close: false,
              notice: `${result.workingDays} working ${result.workingDays === 1 ? 'day' : 'days'} in this request`,
            };
          }
          const draft = await api<{ id: string }>('leave/requests', values);
          if (action === 'submit') await api(`leave/requests/${draft.id}/submit`, { operationId: crypto.randomUUID() });
          reload();
        }}
      />
    );
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <ModalForm
        buttonLabel="Add administrative leave"
        icon={<AddOutlined />}
        title="Administrative leave entry"
        description="This creates approved leave immediately and requires an administrative reason."
        variant="contained"
        fields={[
          { name: 'employeeId', label: 'Employee', options: employeeOptions },
          ...leaveFields,
          { name: 'administrativeReason', label: 'Administrative reason' },
        ]}
        onSubmit={async (values) => {
          await api('hr/leave', { ...values, operationId: crypto.randomUUID() });
          reload();
        }}
      />
      <ModalForm
        buttonLabel="Adjust balance"
        icon={<TuneOutlined />}
        title="Adjust annual balance"
        description="Use a positive number to add days or a negative number to subtract them."
        fields={[
          { name: 'employeeId', label: 'Employee', options: employeeOptions },
          { name: 'year', label: 'Year', type: 'number', value: new Date().getFullYear() },
          leaveFields[0],
          { name: 'days', label: 'Days to add or subtract', type: 'number' },
          { name: 'reason', label: 'Adjustment reason' },
        ]}
        onSubmit={async (values) => {
          await api('hr/leave/adjustments', { ...values, operationId: crypto.randomUUID() });
          reload();
        }}
      />
    </Stack>
  );
}

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee } from '@tms/contracts';
import { api } from '@/lib/api';
import { Card, message, ModalForm, StatusTag, Tag } from './ui';
import { leaveFields, type LeaveDetail } from './leave-types';

export function LeaveDetailView({
  detail,
  error,
  id,
  reload,
  setError,
  user,
}: {
  detail: LeaveDetail | null;
  error: string;
  id: string;
  reload: () => void;
  setError: (value: string) => void;
  user: CurrentEmployee;
}) {
  const draftActions = detail?.status === 'DRAFT' && detail.employeeId === user.id && (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <ModalForm
        buttonLabel="Edit draft"
        title="Edit leave draft"
        fields={leaveFields.map((field) => ({
          ...field,
          value:
            field.name === 'type'
              ? detail.type
              : field.name === 'startDate'
                ? detail.startDate.slice(0, 10)
                : field.name === 'endDate'
                  ? detail.endDate.slice(0, 10)
                  : detail.reason,
        }))}
        onSubmit={async (values) => {
          await api(`leave/requests/${id}`, values, 'PATCH');
          reload();
        }}
      />
      <Button
        variant="contained"
        onClick={async () => {
          try {
            await api(`leave/requests/${id}/submit`, { operationId: crypto.randomUUID() });
            reload();
          } catch (cause) {
            setError(message(cause));
          }
        }}
      >
        Submit draft
      </Button>
    </Stack>
  );
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {detail && (
        <>
          <Card title="Leave request" actions={draftActions}>
            <Stack direction="row" spacing={1}>
              <Tag value={detail.type} />
              <StatusTag value={detail.status} />
            </Stack>
            <Typography sx={{ mt: 2 }}>
              {detail.startDate} → {detail.endDate} · {detail.workingDays} working days
            </Typography>
            <Typography sx={{ mt: 2 }}>{detail.reason}</Typography>
          </Card>
          <Card title="Approval timeline">
            {detail.steps.length ? (
              <Stack component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {detail.steps.map((s) => (
                  <Stack
                    key={s.id}
                    component="li"
                    direction="row"
                    spacing={2}
                    sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
                  >
                    <Tag value={`Step:${s.sequence}`} tone="blue" />
                    <div>
                      <Tag value={s.type} tone="purple" />
                      <Typography variant="body2" color="text.secondary">
                        {s.status}
                        {s.status === 'PENDING' && s.eligible === false ? ' · Approver unavailable — contact HR' : ''}
                      </Typography>
                      {s.reason && <Typography>{s.reason}</Typography>}
                    </div>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography>No approver required.</Typography>
            )}
          </Card>
          {detail.status === 'PENDING' && detail.steps.find((s) => s.status === 'PENDING')?.approverId === user.id && (
            <Card title="Your decision">
              <ModalForm
                buttonLabel="Review request"
                title="Record your decision"
                variant="contained"
                fields={[{ name: 'reason', label: 'Reason (required for rejection)', optional: true }]}
                actions={[
                  { label: 'Reject', value: 'REJECTED', variant: 'outlined', color: 'error' },
                  { label: 'Approve', value: 'APPROVED', variant: 'contained' },
                ]}
                onSubmit={async ({ action, ...v }) => {
                  await api(`leave/requests/${id}/decision`, { ...v, decision: action });
                  reload();
                }}
              />
            </Card>
          )}
          {detail.employeeId === user.id && ['PENDING', 'APPROVED'].includes(detail.status) && (
            <Card title="Cancel leave">
              <ModalForm
                buttonLabel="Request cancellation"
                title="Request leave cancellation"
                submitLabel="Request cancellation"
                fields={[{ name: 'reason', label: 'Cancellation reason' }]}
                onSubmit={async (v) => {
                  await api(`leave/requests/${id}/cancel`, { ...v, operationId: crypto.randomUUID() });
                  reload();
                }}
              />
            </Card>
          )}
          {detail.cancellations.map((c) => (
            <Card key={c.id} title={`Cancellation · ${c.status}`}>
              {c.status === 'PENDING' && c.steps.find((s) => s.status === 'PENDING')?.approverId === user.id ? (
                <ModalForm
                  buttonLabel="Review cancellation"
                  title="Review cancellation request"
                  fields={[{ name: 'reason', label: 'Reason (required for rejection)', optional: true }]}
                  actions={[
                    { label: 'Reject cancellation', value: 'REJECTED', variant: 'outlined', color: 'error' },
                    { label: 'Approve cancellation', value: 'APPROVED', variant: 'contained' },
                  ]}
                  onSubmit={async ({ action, ...v }) => {
                    await api(`leave/cancellations/${c.id}/decision`, { ...v, decision: action });
                    reload();
                  }}
                />
              ) : (
                <Typography>Cancellation follows the original approval chain.</Typography>
              )}
            </Card>
          ))}
        </>
      )}
    </Stack>
  );
}

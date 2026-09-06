'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddOutlined from '@mui/icons-material/AddOutlined';
import EditCalendarOutlined from '@mui/icons-material/EditCalendarOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import type { CurrentEmployee, LeaveBalance, PageResult, DirectoryEmployee } from '@tms/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, message, ModalForm, type Field } from './ui';
interface RequestRow {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  workingDays: number;
  employee?: { firstName: string; lastName: string };
}
interface Step {
  id: string;
  sequence: number;
  type: string;
  approverId: string;
  status: string;
  eligible?: boolean;
  reason?: string;
}
interface Detail extends RequestRow {
  employeeId: string;
  reason?: string;
  steps: Step[];
  cancellations: { id: string; status: string; steps: Step[] }[];
}
interface Inbox {
  steps: (Step & {
    request: {
      id: string;
      status: string;
      startDate: string;
      endDate: string;
      employee: { firstName: string; lastName: string };
    };
  })[];
  cancellations: (Step & { cancellation: { id: string; requestId: string; status: string } })[];
}
const leaveFields: Field[] = [
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
export function LeaveScreens({ path, user }: { path: string; user: CurrentEmployee }) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]),
    [rows, setRows] = useState<RequestRow[]>([]),
    [inbox, setInbox] = useState<Inbox>({ steps: [], cancellations: [] }),
    [detail, setDetail] = useState<Detail | null>(null),
    [people, setPeople] = useState<DirectoryEmployee[]>([]),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [preview, setPreview] = useState(''),
    [requestSearch, setRequestSearch] = useState(''),
    [requestStatus, setRequestStatus] = useState('ALL');
  const id = path.startsWith('/leave/') ? path.split('/')[2] : undefined;
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (id) {
          const r = await api<Detail>(`leave/requests/${id}`);
          if (active) setDetail(r);
        } else if (path === '/approvals') {
          const r = await api<Inbox>('approvals');
          if (active) setInbox(r);
        } else {
          const [b, r] = await Promise.all([
            api<LeaveBalance[]>('leave/balances'),
            api<PageResult<RequestRow>>(path === '/hr' ? 'hr/leave' : 'leave/requests'),
          ]);
          if (active) {
            setBalances(b);
            setRows(r.items);
          }
          if (path === '/hr') {
            const p = await api<PageResult<DirectoryEmployee>>('directory/employees?pageSize=100');
            if (active) setPeople(p.items);
          }
        }
        if (active) setError('');
      } catch (e) {
        if (active) setError(message(e));
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, path, revision]);
  const reload = () => setRevision((r) => r + 1);
  if (id)
    return (
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        {detail && (
          <>
            <Card title={detail.type.replaceAll('_', ' ')}>
              <Chip label={detail.status} />
              <Typography sx={{ mt: 2 }}>
                {detail.startDate} → {detail.endDate} · {detail.workingDays} working days
              </Typography>
              <Typography sx={{ mt: 2 }}>{detail.reason}</Typography>
            </Card>
            <Card title="Approval timeline">
              {detail.steps.length ? (
                detail.steps.map((s) => (
                  <Stack key={s.id} direction="row" spacing={2} sx={{ py: 2, borderBottom: '1px solid #eee' }}>
                    <Chip label={s.sequence} />
                    <div>
                      <Typography>{s.type.replaceAll('_', ' ')}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {s.status}
                        {s.status === 'PENDING' && s.eligible === false ? ' · Approver unavailable — contact HR' : ''}
                      </Typography>
                      {s.reason && <Typography>{s.reason}</Typography>}
                    </div>
                  </Stack>
                ))
              ) : (
                <Typography>No approver required.</Typography>
              )}
            </Card>
            {detail.status === 'DRAFT' && detail.employeeId === user.id && (
              <Button
                variant="contained"
                onClick={async () => {
                  try {
                    await api(`leave/requests/${id}/submit`, { operationId: crypto.randomUUID() });
                    reload();
                  } catch (e) {
                    setError(message(e));
                  }
                }}
              >
                Submit draft
              </Button>
            )}
            {detail.status === 'PENDING' &&
              detail.steps.find((s) => s.status === 'PENDING')?.approverId === user.id && (
                <Card title="Your decision">
                  <ModalForm
                    buttonLabel="Review request"
                    title="Record your decision"
                    variant="contained"
                    submitLabel="Record decision"
                    fields={[
                      {
                        name: 'decision',
                        label: 'Decision',
                        options: [
                          { value: 'APPROVED', label: 'Approve' },
                          { value: 'REJECTED', label: 'Reject' },
                        ],
                      },
                      { name: 'reason', label: 'Reason (required for rejection)', optional: true },
                    ]}
                    onSubmit={async (v) => {
                      await api(`leave/requests/${id}/decision`, v);
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
                    fields={[
                      {
                        name: 'decision',
                        label: 'Decision',
                        options: [
                          { value: 'APPROVED', label: 'Approve cancellation' },
                          { value: 'REJECTED', label: 'Reject cancellation' },
                        ],
                      },
                      { name: 'reason', label: 'Reason', optional: true },
                    ]}
                    onSubmit={async (v) => {
                      await api(`leave/cancellations/${c.id}/decision`, v);
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
  if (path === '/approvals')
    return (
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}
        <Card title="Assigned leave approvals">
          {inbox.steps.length ? (
            inbox.steps.map((s) => (
              <Stack
                direction="row"
                key={s.id}
                sx={{ justifyContent: 'space-between', gap: 2, py: 2, borderBottom: '1px solid #eee' }}
              >
                <div>
                  <Link href={`/leave/${s.request.id}`}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {s.request.employee.firstName} {s.request.employee.lastName}
                    </Typography>
                  </Link>
                  <Typography variant="body2">
                    {s.request.startDate.slice(0, 10)} → {s.request.endDate.slice(0, 10)} · Step {s.sequence}
                  </Typography>
                </div>
                <Chip label={s.status} />
              </Stack>
            ))
          ) : (
            <Typography color="text.secondary">You’re all caught up.</Typography>
          )}
        </Card>
        <Card title="Cancellation approvals">
          {inbox.cancellations.map((c) => (
            <Typography key={c.id} sx={{ my: 1 }}>
              <Link href={`/leave/${c.cancellation.requestId}`}>Cancellation · {c.status}</Link>
            </Typography>
          ))}
        </Card>
      </Stack>
    );
  const employeeOptions = people.filter((p) => p.id !== user.id).map((p) => ({ value: p.id, label: p.displayName }));
  const filteredRows = rows.filter(
    (row) =>
      (requestStatus === 'ALL' || row.status === requestStatus) &&
      `${row.type} ${row.status} ${row.startDate} ${row.endDate}`.toLowerCase().includes(requestSearch.toLowerCase()),
  );
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <div className="stats">
        {balances.map((b) => (
          <Card key={b.type} title={b.type.replaceAll('_', ' ')}>
            <Typography variant="h3">
              {b.available}
              <Typography component="span" color="text.secondary">
                {' '}
                days left
              </Typography>
            </Typography>
            <Typography variant="body2" sx={{ mt: 2 }}>
              {b.used} used · {b.reserved} reserved · {b.entitlement} entitlement
            </Typography>
          </Card>
        ))}
      </div>
      <Card title={path === '/hr' ? 'Employee leave records' : 'My requests'}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            label="Search requests"
            placeholder="Type, status, or date"
            value={requestSearch}
            onChange={(event) => setRequestSearch(event.target.value)}
            sx={{ minWidth: { md: 280 } }}
          />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            {['ALL', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((status) => (
              <Chip
                key={status}
                label={status === 'ALL' ? 'All' : status.toLowerCase()}
                color={requestStatus === status ? 'primary' : 'default'}
                variant={requestStatus === status ? 'filled' : 'outlined'}
                onClick={() => setRequestStatus(status)}
              />
            ))}
          </Stack>
        </Stack>
        {filteredRows.length ? (
          filteredRows.map((r) => (
            <Stack
              key={r.id}
              direction={{ xs: 'column', sm: 'row' }}
              sx={{ justifyContent: 'space-between', gap: 1, py: 2, borderBottom: '1px solid #eee' }}
            >
              <Link href={`/leave/${r.id}`}>
                <Typography sx={{ fontWeight: 600 }}>
                  {r.type.replaceAll('_', ' ')}
                  {r.employee ? ` · ${r.employee.firstName} ${r.employee.lastName}` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {r.startDate} → {r.endDate} · {r.workingDays} working days
                </Typography>
              </Link>
              <Chip label={r.status} size="small" />
            </Stack>
          ))
        ) : (
          <Typography color="text.secondary">No requests match these filters.</Typography>
        )}
      </Card>
      <Card className="action-bar" title={path === '/hr' ? 'HR actions' : 'Ready to plan time away?'}>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {path === '/hr'
            ? 'Administrative entries and balance changes open in a focused review dialog.'
            : 'Weekends and bank holidays do not count. You can preview dates before filing.'}
        </Typography>
        {preview && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {preview}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {path !== '/hr' ? (
            <ModalForm
              buttonLabel="File leave"
              icon={<EditCalendarOutlined />}
              title="File a leave request"
              description="Review the dates and action carefully. Pending requests reserve your allowance."
              variant="contained"
              submitLabel="Continue"
              fields={[
                ...leaveFields,
                {
                  name: 'action',
                  label: 'Action',
                  value: 'submit',
                  options: [
                    { value: 'submit', label: 'Submit for approval' },
                    { value: 'draft', label: 'Save draft' },
                    { value: 'preview', label: 'Preview working days' },
                  ],
                },
              ]}
              onSubmit={async ({ action, ...v }) => {
                if (action === 'preview') {
                  const result = await api<{ workingDays: number }>('leave/preview', v);
                  setPreview(`${result.workingDays} working days in this request`);
                  return;
                }
                const draft = await api<{ id: string }>('leave/requests', v);
                if (action === 'submit')
                  await api(`leave/requests/${draft.id}/submit`, { operationId: crypto.randomUUID() });
                reload();
              }}
            />
          ) : (
            <>
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
                onSubmit={async (v) => {
                  await api('hr/leave', { ...v, operationId: crypto.randomUUID() });
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
                onSubmit={async (v) => {
                  await api('hr/leave/adjustments', { ...v, operationId: crypto.randomUUID() });
                  reload();
                }}
              />
            </>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

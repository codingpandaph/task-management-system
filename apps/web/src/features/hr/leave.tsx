'use client';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import type { CurrentEmployee, LeaveBalance, PageResult, DirectoryEmployee } from '@tms/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, LoadingState, message, ModalForm, StatusTag, Tag } from './ui';
import { LeaveActions } from './leave-actions';
import { plainName } from './plain-language';
import { LeaveApprovalsView } from './leave-approvals-view';
import { LeaveDetailView } from './leave-detail-view';
import { leaveFields, type LeaveDetail as Detail, type LeaveInbox as Inbox, type RequestRow } from './leave-types';
export function LeaveScreens({ path, user }: { path: string; user: CurrentEmployee }) {
  const [balances, setBalances] = useState<LeaveBalance[]>([]),
    [rows, setRows] = useState<RequestRow[]>([]),
    [inbox, setInbox] = useState<Inbox>({ steps: [], cancellations: [] }),
    [detail, setDetail] = useState<Detail | null>(null),
    [people, setPeople] = useState<DirectoryEmployee[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [approvalTab, setApprovalTab] = useState(0),
    [approvalSearch, setApprovalSearch] = useState(''),
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
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, path, revision]);
  const reload = () => setRevision((r) => r + 1);
  if (loading) return <LoadingState label="Loading leave workspace" />;
  if (id)
    return <LeaveDetailView detail={detail} error={error} id={id} reload={reload} setError={setError} user={user} />;
  if (path === '/approvals')
    return (
      <LeaveApprovalsView
        inbox={inbox}
        error={error}
        search={approvalSearch}
        setSearch={setApprovalSearch}
        tab={approvalTab}
        setTab={setApprovalTab}
      />
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
          <Card key={b.type} title={plainName(b.type)}>
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
            <LinearProgress
              aria-label={`${plainName(b.type)} allowance used`}
              value={b.entitlement ? Math.min(100, ((b.used + b.reserved) / b.entitlement) * 100) : 0}
              variant="determinate"
              sx={{ mt: 2, height: 7, borderRadius: 'var(--radius-control)', bgcolor: 'var(--color-line)' }}
            />
          </Card>
        ))}
      </div>
      <Card
        title={path === '/hr' ? 'Employee leave records' : 'My requests'}
        actions={<LeaveActions hrMode={path === '/hr'} employeeOptions={employeeOptions} reload={reload} />}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            label="Search requests"
            placeholder="Type, status, or date"
            value={requestSearch}
            onChange={(event) => setRequestSearch(event.target.value)}
            sx={{ minWidth: { md: 280 } }}
          />
          <TextField
            select
            label="Status"
            value={requestStatus}
            onChange={(event) => setRequestStatus(event.target.value)}
            sx={{ minWidth: 160 }}
          >
            {['ALL', 'DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((status) => (
              <MenuItem key={status} value={status}>
                {status === 'ALL' ? 'All statuses' : status.toLowerCase()}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }} aria-live="polite">
            {filteredRows.length} {filteredRows.length === 1 ? 'request' : 'requests'}
          </Typography>
        </Stack>
        {filteredRows.length ? (
          filteredRows.map((r) => (
            <Stack
              key={r.id}
              direction={{ xs: 'column', sm: 'row' }}
              sx={{ justifyContent: 'space-between', gap: 1, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Link href={`/leave/${r.id}`}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Tag value={r.type} />
                  <Typography sx={{ fontWeight: 600 }}>
                    {r.employee ? ` · ${r.employee.firstName} ${r.employee.lastName}` : ''}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {r.startDate} → {r.endDate} · {r.workingDays} working days
                </Typography>
              </Link>
              <StatusTag value={r.status} />
              {path === '/hr' && r.employee && ['PENDING', 'APPROVED'].includes(r.status) && (
                <ModalForm
                  buttonLabel="Correct"
                  title="Correct administrative leave"
                  description="The original charge is reversed and the corrected entry is posted atomically."
                  fields={[
                    ...leaveFields.map((field) => ({
                      ...field,
                      value:
                        field.name === 'type'
                          ? r.type
                          : field.name === 'startDate'
                            ? r.startDate.slice(0, 10)
                            : field.name === 'endDate'
                              ? r.endDate.slice(0, 10)
                              : undefined,
                    })),
                    { name: 'administrativeReason', label: 'Correction reason' },
                  ]}
                  onSubmit={async (v) => {
                    await api(`hr/leave/${r.id}/correct`, {
                      ...v,
                      employeeId: r.employee!.id,
                      operationId: crypto.randomUUID(),
                    });
                    reload();
                  }}
                />
              )}
            </Stack>
          ))
        ) : (
          <EmptyState title="No leave requests found" detail="Try another status or clear your search." />
        )}
      </Card>
    </Stack>
  );
}

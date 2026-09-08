import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { Card, EmptyState, StatusTag, Tag } from './ui';
import type { LeaveInbox } from './leave-types';

export function LeaveApprovalsView({
  inbox,
  error,
  search,
  setSearch,
  tab,
  setTab,
}: {
  inbox: LeaveInbox;
  error: string;
  search: string;
  setSearch: (value: string) => void;
  tab: number;
  setTab: (value: number) => void;
}) {
  const approvalSteps = inbox.steps.filter((step) =>
    `${step.request.employee.firstName} ${step.request.employee.lastName} ${step.request.startDate} ${step.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const cancellationSteps = inbox.cancellations.filter((step) =>
    `${step.cancellation.request.employee.firstName} ${step.cancellation.request.employee.lastName} ${step.cancellation.status} ${step.cancellation.reason}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <Card title="Approval inbox">
        <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Tabs value={tab} onChange={(_, value: number) => setTab(value)} aria-label="Approval queues">
            <Tab label={`Leave requests (${inbox.steps.length})`} />
            <Tab label={`Cancellations (${inbox.cancellations.length})`} />
          </Tabs>
          <TextField
            label={tab === 0 ? 'Search leave approvals' : 'Search cancellations'}
            size="small"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>
        {tab === 0 &&
          (approvalSteps.length ? (
            <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {approvalSteps.map((s) => (
                <Stack
                  direction="row"
                  key={s.id}
                  component="li"
                  sx={{
                    justifyContent: 'space-between',
                    gap: 2,
                    py: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
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
                    <Typography variant="caption" color="text.secondary">
                      Open request to review dates and approval history
                    </Typography>
                  </div>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Tag value={`Step:${s.sequence}`} tone="blue" />
                    <StatusTag value={s.status} />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ) : (
            <EmptyState title="You’re all caught up" detail="New approval requests will appear here." />
          ))}
        {tab === 1 &&
          (cancellationSteps.length ? (
            <Stack component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {cancellationSteps.map((c) => (
                <Stack
                  component="li"
                  key={c.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  sx={{
                    justifyContent: 'space-between',
                    gap: 1,
                    py: 2,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <div>
                    <Link href={`/leave/${c.cancellation.requestId}`}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {c.cancellation.request.employee.firstName} {c.cancellation.request.employee.lastName}
                      </Typography>
                    </Link>
                    <Typography variant="body2">
                      {c.cancellation.request.startDate.slice(0, 10)} → {c.cancellation.request.endDate.slice(0, 10)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {c.cancellation.reason}
                    </Typography>
                  </div>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Tag value={`Step:${c.sequence}`} tone="blue" />
                    <StatusTag value={c.status} />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          ) : (
            <EmptyState
              title="No cancellation reviews"
              detail="Cancellation requests assigned to you will appear here."
            />
          ))}
      </Card>
    </Stack>
  );
}

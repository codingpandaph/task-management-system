'use client';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, message, StatusTag } from './ui';

export interface Notice {
  id: string;
  title: string;
  resourceType: string;
  resourceId: string;
  readAt: string | null;
}
export interface Audit {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

function href(notice: Notice) {
  if (notice.resourceType === 'LeaveRequest') return `/leave/${notice.resourceId}`;
  if (notice.resourceType === 'Task') return '/workspaces';
  return `/employees/${notice.resourceId}`;
}

export function AuditScreen({ audit, error }: { audit: Audit[]; error: string }) {
  const [search, setSearch] = useState('');
  const visible = audit.filter((item) =>
    `${item.action} ${item.targetType} ${item.targetId}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Card title="Audit history">
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Search audit history"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        size="small"
        sx={{ mb: 2, minWidth: { sm: 320 } }}
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
      {visible.map((item) => (
        <Box key={item.id} sx={{ py: 2, borderBottom: '1px solid', borderColor: 'divider', overflowWrap: 'anywhere' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <StatusTag value={item.action} />
            <Typography variant="body2" color="text.secondary">
              {item.targetType}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {new Date(item.createdAt).toLocaleString()} · {item.targetId}
          </Typography>
        </Box>
      ))}
      {!visible.length && <EmptyState title="No audit events found" detail="Try a different action or target." />}
    </Card>
  );
}

type NoticeProps = {
  notices: Notice[];
  setNotices: Dispatch<SetStateAction<Notice[]>>;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
};
export function NotificationsScreen({ notices, setNotices, error, setError }: NoticeProps) {
  const [tab, setTab] = useState(0);
  const visible = notices.filter((notice) => tab === 0 || !notice.readAt);
  const unread = notices.filter((notice) => !notice.readAt).length;
  async function markAll() {
    try {
      await api('notifications/read-all', {});
      const readAt = new Date().toISOString();
      setNotices((current) => current.map((notice) => ({ ...notice, readAt: notice.readAt ?? readAt })));
    } catch (cause) {
      setError(message(cause));
    }
  }
  return (
    <Card title="Your notifications">
      {error && <Alert severity="error">{error}</Alert>}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 1 }}
      >
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} aria-label="Notification filters">
          <Tab label={`All (${notices.length})`} />
          <Tab label={`Unread (${unread})`} />
        </Tabs>
        {!!unread && <Button onClick={markAll}>Mark all read</Button>}
      </Stack>
      {visible.map((notice) => (
        <Stack
          key={notice.id}
          direction="row"
          sx={{ justifyContent: 'space-between', gap: 2, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Typography>
            <Link href={href(notice)}>{notice.title}</Link>
          </Typography>
          {!notice.readAt && (
            <Button
              onClick={async () => {
                try {
                  await api(`notifications/${notice.id}/read`, {});
                  setNotices((items) =>
                    items.map((item) => (item.id === notice.id ? { ...item, readAt: new Date().toISOString() } : item)),
                  );
                } catch (cause) {
                  setError(message(cause));
                }
              }}
            >
              Mark read
            </Button>
          )}
        </Stack>
      ))}
      {!visible.length && (
        <EmptyState
          title={tab === 1 ? 'No unread notifications' : 'You’re up to date'}
          detail="New approvals and HR events will appear here."
        />
      )}
    </Card>
  );
}

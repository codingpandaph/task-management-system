'use client';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import BeachAccessOutlined from '@mui/icons-material/BeachAccessOutlined';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined';
import type { CurrentEmployee, PageResult } from '@tms/contracts';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, EmptyState, LoadingState, message, Tag } from './ui';
import { AuditScreen, NotificationsScreen, type Audit, type Notice } from './activity-screens';
interface Absence {
  id: string;
  startDate: string;
  endDate: string;
  employee: { id: string; firstName: string; lastName: string; department: { id: string; name: string } | null };
}
interface Dashboard {
  active: number;
  pending: number;
  onLeave: number;
  suspended: number;
  usedDays: number;
  contracts: {
    employeeId: string;
    endDate: string;
    daysRemaining: number;
    employee: { firstName: string; lastName: string };
  }[];
  probation: { employeeId: string; probationEnd: string; employee: { firstName: string; lastName: string } }[];
}
export function OverviewScreens({ path, user }: { path: string; user: CurrentEmployee }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)),
    [calendarDepartment, setCalendarDepartment] = useState('ALL'),
    [events, setEvents] = useState<Absence[]>([]),
    [notices, setNotices] = useState<Notice[]>([]),
    [audit, setAudit] = useState<PageResult<Audit>>({ items: [], total: 0, page: 1, pageSize: 20 }),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const broad =
    user.position === 'MANAGING_DIRECTOR' ||
    (user.department?.kind === 'HR' && user.permissions.includes('REPORTING_READ'));
  const overview = broad || ['SENIOR_DIRECTOR', 'ACCOUNT_DIRECTOR'].includes(user.position);
  const start = `${month}-01`,
    last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate(),
    end = `${month}-${last}`;
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (path === '/audit') {
          const r = await api<PageResult<Audit>>('audit');
          if (active) setAudit(r);
        } else if (path === '/notifications') {
          const r = await api<Notice[]>('notifications');
          if (active) setNotices(r);
        } else {
          const e = await api<Absence[]>(`reporting/calendar?start=${start}&end=${end}`);
          if (active) setEvents(e);
          if (path === '/' && overview) {
            const d = await api<Dashboard>('reporting/dashboard');
            if (active) setDashboard(d);
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
  }, [path, start, end, overview]);
  function shift(offset: number) {
    const d = new Date(`${month}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + offset);
    setMonth(d.toISOString().slice(0, 7));
  }
  if (loading) return <LoadingState label="Loading workspace" />;
  const calendarDepartments = Array.from(
      new Map(
        events
          .filter((event) => event.employee.department)
          .map((event) => [event.employee.department!.id, event.employee.department!]),
      ).values(),
    ),
    visibleEvents = events.filter(
      (event) => calendarDepartment === 'ALL' || event.employee.department?.id === calendarDepartment,
    );
  if (path === '/audit') return <AuditScreen initial={audit} error={error} />;
  if (path === '/notifications')
    return <NotificationsScreen notices={notices} setNotices={setNotices} error={error} setError={setError} />;
  const calendar = (
    <Card
      title={
        broad
          ? 'Organization leave calendar'
          : ['SENIOR_DIRECTOR', 'ACCOUNT_DIRECTOR'].includes(user.position)
            ? 'Department leave calendar'
            : 'My leave calendar'
      }
    >
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {broad
          ? 'Approved leave across the organization.'
          : ['SENIOR_DIRECTOR', 'ACCOUNT_DIRECTOR'].includes(user.position)
            ? `Approved leave in ${user.department?.name ?? 'your department'}.`
            : 'Your approved leave. Only your absences appear here.'}
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} sx={{ justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
          <Typography variant="h6">
            {new Date(`${month}-15`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </Typography>
          {broad && (
            <TextField
              select
              label="Calendar department"
              size="small"
              value={calendarDepartment}
              onChange={(event) => setCalendarDepartment(event.target.value)}
              sx={{ minWidth: 190 }}
            >
              <MenuItem value="ALL">All departments</MenuItem>
              {calendarDepartments.map((department) => (
                <MenuItem key={department.id} value={department.id}>
                  {department.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
        <Stack direction="row">
          <Button aria-label="Previous month" onClick={() => shift(-1)}>
            <ArrowBackOutlined />
          </Button>
          <Button onClick={() => setMonth(new Date().toISOString().slice(0, 7))}>Today</Button>
          <Button aria-label="Next month" onClick={() => shift(1)}>
            <ArrowForwardOutlined />
          </Button>
        </Stack>
      </Stack>
      <div className="calendar-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <Typography key={d} sx={{ p: 1, fontSize: 'var(--text-caption)', color: 'text.secondary' }}>
            {d}
          </Typography>
        ))}
        {Array.from({ length: (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => (
          <div className="calendar-day" key={`empty-${i}`} />
        ))}
        {Array.from({ length: last }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, '0')}`;
          return (
            <div
              key={day}
              className={`calendar-day${day === new Date().toISOString().slice(0, 10) ? ' calendar-today' : ''}`}
            >
              <Typography variant="caption" color="text.secondary">
                {i + 1}
              </Typography>
              {visibleEvents
                .filter((e) => e.startDate.slice(0, 10) <= day && e.endDate.slice(0, 10) >= day)
                .map((e) => (
                  <span
                    className="calendar-event"
                    key={e.id}
                    title={e.employee.department?.name ?? 'Organization-wide'}
                  >
                    {e.employee.firstName} {e.employee.lastName}
                  </span>
                ))}
            </div>
          );
        })}
      </div>
      <Box sx={{ mt: 3 }}>
        {visibleEvents.length ? (
          visibleEvents.map((e) => (
            <Stack
              key={e.id}
              direction={{ xs: 'column', sm: 'row' }}
              sx={{ justifyContent: 'space-between', py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {e.employee.firstName} {e.employee.lastName}
                </Typography>
                <Tag value={e.employee.department?.name ?? 'Organization-wide'} tone="teal" />
              </Stack>
              <Typography variant="body2">
                {e.startDate.slice(0, 10)} — {e.endDate.slice(0, 10)}
              </Typography>
            </Stack>
          ))
        ) : (
          <EmptyState title="No approved leave this month" detail="There are no approved absences in this month." />
        )}
      </Box>
    </Card>
  );
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {path === '/' && (
        <>
          {dashboard && (
            <div className="stats">
              {[
                ['Active employees', dashboard.active, <GroupsOutlined key="active" />],
                ['Currently away', dashboard.onLeave, <BeachAccessOutlined key="away" />],
                ['Pending leave', dashboard.pending, <PendingActionsOutlined key="pending" />],
                ['Days used', dashboard.usedDays, <CalendarTodayOutlined key="used" />],
              ].map(([label, value, icon]) => (
                <Card key={String(label)} title={String(label)} className="metric-card">
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'end' }}>
                    <Typography variant="h3">{value}</Typography>
                    <span className="metric-icon">{icon}</span>
                  </Stack>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {calendar}
      {path === '/' && dashboard && (
        <div className="grid-two">
          <Card title="Contracts approaching expiry">
            {dashboard.contracts.map((c) => (
              <Typography key={c.employeeId} sx={{ my: 1 }}>
                {c.employee.firstName} {c.employee.lastName} · {c.daysRemaining} days remaining
              </Typography>
            ))}
            {!dashboard.contracts.length && (
              <EmptyState title="No urgent contracts" detail="Nothing expires in the next 90 days." />
            )}
          </Card>
          <Card title="Probation reviews">
            {dashboard.probation.map((p) => (
              <Typography key={p.employeeId} sx={{ my: 1 }}>
                {p.employee.firstName} {p.employee.lastName} · {p.probationEnd.slice(0, 10)}
              </Typography>
            ))}
            {!dashboard.probation.length && (
              <EmptyState title="No reviews due" detail="Upcoming probation reviews will be listed here." />
            )}
          </Card>
        </div>
      )}
    </Stack>
  );
}

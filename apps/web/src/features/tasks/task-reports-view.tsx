import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Card, EmptyState, Tag } from '../hr/ui';
import type { TaskReport } from './task-types';

export function TaskReportsView({
  reports,
  search,
  setSearch,
}: {
  reports: TaskReport[];
  search: string;
  setSearch: (value: string) => void;
}) {
  const visible = reports.filter((report) =>
    `${report.name} ${report.code}`.toLowerCase().includes(search.toLowerCase()),
  );
  const portfolio = reports.reduce(
    (total, report) => ({
      tasks: total.tasks + report.total,
      completed: total.completed + report.completed,
      blocked: total.blocked + report.blocked,
      risks: total.risks + report.escalated + report.capacityRisks,
      throughput: total.throughput + report.throughput30Days,
    }),
    { tasks: 0, completed: 0, blocked: 0, risks: 0, throughput: 0 },
  );
  return (
    <Stack spacing={3}>
      <Paper variant="outlined" className="task-hero">
        <Box>
          <Typography variant="h5" component="h2">
            Department delivery
          </Typography>
          <Typography color="text.secondary">
            Live workload, completion, ownership, and escalation across the teams you lead.
          </Typography>
        </Box>
      </Paper>
      <div className="stats">
        {[
          ['Completion', portfolio.tasks ? `${Math.round((portfolio.completed / portfolio.tasks) * 100)}%` : '0%'],
          ['Open work', portfolio.tasks - portfolio.completed],
          ['Blocked', portfolio.blocked],
          ['30-day throughput', portfolio.throughput],
        ].map(([label, value]) => (
          <Paper variant="outlined" key={label} sx={{ p: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {value}
            </Typography>
          </Paper>
        ))}
      </div>
      <Card
        title="Department performance"
        actions={
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            label="Search departments"
            size="small"
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
        }
      >
        <div className="metric-grid">
          {visible.map((report) => (
            <Paper variant="outlined" key={report.id} sx={{ p: 3 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="h6">{report.name}</Typography>
                <Tag value={report.code} tone="teal" />
              </Stack>
              <Typography variant="h3" sx={{ mt: 2 }}>
                {report.completed}/{report.total}
              </Typography>
              <Typography color="text.secondary">tasks completed</Typography>
              <LinearProgress
                variant="determinate"
                value={report.total ? (report.completed / report.total) * 100 : 0}
                sx={{ my: 2, height: 8, borderRadius: 8 }}
              />
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
                    {report.unassigned}
                  </Typography>
                  <Tag value="UNASSIGNED" tone={report.unassigned ? 'amber' : 'green'} />
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
                    {report.blocked}
                  </Typography>
                  <Tag value="BLOCKED" tone={report.blocked ? 'red' : 'green'} />
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
                    {report.escalated}
                  </Typography>
                  <Tag value="ESCALATED" tone={report.escalated ? 'red' : 'green'} />
                </Stack>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
                    {report.estimatedHours}h
                  </Typography>
                  <Tag value="OPEN" tone="blue" />
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
                {[
                  [report.inProgress, 'ACTIVE', 'blue'],
                  [report.inReview, 'REVIEW', 'purple'],
                  [report.capacityRisks, 'CAPACITY', report.capacityRisks ? 'red' : 'green'],
                ].map(([count, label, tone]) => (
                  <Stack key={label} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {count}
                    </Typography>
                    <Tag value={String(label)} tone={tone as 'blue' | 'purple' | 'red' | 'green'} />
                  </Stack>
                ))}
              </Stack>
              <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="h6">{report.throughput30Days}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Finished in 30 days
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h6">{report.averageCycleDays}d</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Average cycle time
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.75 }}>
                Highest active workloads
              </Typography>
              {report.memberLoad.slice(0, 5).map((member) => (
                <Stack key={member.id} direction="row" sx={{ justifyContent: 'space-between', py: 0.5 }}>
                  <Typography variant="body2">{member.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {member.tasks} tasks · {member.hours}h
                  </Typography>
                </Stack>
              ))}
              {!report.memberLoad.length && (
                <Typography variant="body2" color="text.secondary">
                  No assigned open work
                </Typography>
              )}
            </Paper>
          ))}
        </div>
        {!visible.length && <EmptyState title="No matching departments" detail="Try a department name or code." />}
      </Card>
    </Stack>
  );
}

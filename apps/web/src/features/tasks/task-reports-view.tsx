import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { EmptyState, Tag } from '../hr/ui';
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
      <TextField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        label="Search departments"
        size="small"
        sx={{ maxWidth: 420 }}
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
      <div className="metric-grid">
        {reports
          .filter((report) => `${report.name} ${report.code}`.toLowerCase().includes(search.toLowerCase()))
          .map((report) => (
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
            </Paper>
          ))}
      </div>
      {!reports.some((report) => `${report.name} ${report.code}`.toLowerCase().includes(search.toLowerCase())) && (
        <EmptyState title="No matching departments" detail="Try a department name or code." />
      )}
    </Stack>
  );
}

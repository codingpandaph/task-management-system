import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee } from '@tms/contracts';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Workspace } from './task-types';

export function MilestoneStrip({
  workspace,
  user,
  refresh,
}: {
  workspace: Workspace;
  user: CurrentEmployee;
  refresh: () => Promise<void>;
}) {
  const [capacity, setCapacity] = useState<{
    milestoneId: string;
    collaborators: { id: string; name: string }[];
    businessDays: number;
    approvedLeaveDays: number;
    available: string;
    planned: string;
    remainingHours: number;
    isOvercapacity: boolean;
  }>();
  const manager =
    user.position === 'SENIOR_DIRECTOR' ||
    (user.position === 'ACCOUNT_DIRECTOR' && user.department.id === workspace.departmentId);
  if (!workspace.milestones.length) return null;
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ overflowX: { sm: 'auto' }, pb: 0.5 }}
        aria-label="Open milestones"
      >
        {workspace.milestones.map((milestone) => (
          <Button
            key={milestone.id}
            variant="outlined"
            color={milestone.isOvercapacity ? 'error' : 'primary'}
            sx={{ flexShrink: 0, justifyContent: 'space-between', width: { xs: '100%', sm: 'auto' } }}
            onClick={() => api<typeof capacity>(`milestones/${milestone.id}/capacity`).then(setCapacity)}
          >
            {milestone.name} · {new Date(milestone.dueDate).toLocaleDateString('en-GB')}
          </Button>
        ))}
      </Stack>
      <Dialog open={!!capacity} onClose={() => setCapacity(undefined)} fullWidth maxWidth="xs">
        <DialogTitle>Milestone capacity</DialogTitle>
        <DialogContent dividers>
          {capacity && (
            <Stack spacing={2}>
              {capacity.isOvercapacity && <Alert severity="warning">Planned work exceeds available capacity.</Alert>}
              <div className="metric-grid compact">
                <Box>
                  <Typography variant="h5" component="p">
                    {capacity.available}
                  </Typography>
                  <Typography variant="caption">Available</Typography>
                </Box>
                <Box>
                  <Typography variant="h5" component="p">
                    {capacity.planned}
                  </Typography>
                  <Typography variant="caption">Planned</Typography>
                </Box>
              </div>
              <Typography variant="body2">
                {capacity.collaborators.length} collaborators · {capacity.businessDays} business days ·{' '}
                {capacity.approvedLeaveDays} approved leave days
              </Typography>
              <Typography variant="body2" color={capacity.remainingHours < 0 ? 'error' : 'text.secondary'}>
                {capacity.remainingHours} hours remaining
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {manager && capacity && (
            <Button
              color="error"
              onClick={async () => {
                await api(`milestones/${capacity.milestoneId}/close`, {});
                setCapacity(undefined);
                await refresh();
              }}
            >
              Close milestone
            </Button>
          )}
          <Button onClick={() => setCapacity(undefined)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

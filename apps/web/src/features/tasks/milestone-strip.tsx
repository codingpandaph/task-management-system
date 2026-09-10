import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee } from '@tms/contracts';
import { useState } from 'react';
import { api } from '@/lib/api';
import type { Milestone, Workspace } from './task-types';

export function MilestoneStrip({
  workspace,
  milestone,
  canClose,
  user,
  refresh,
}: {
  workspace: Workspace;
  milestone: Milestone | null;
  canClose: boolean;
  user: CurrentEmployee;
  refresh: () => Promise<void>;
}) {
  const [capacity, setCapacity] = useState<{
    milestoneId: string;
    teamMembers: { id: string; name: string }[];
    businessDays: number;
    approvedLeaveDays: number;
    available: string;
    planned: string;
    remainingHours: number;
    isOvercapacity: boolean;
  }>();
  const [confirming, setConfirming] = useState(false);
  const manager = user.position === 'ACCOUNT_DIRECTOR' && user.team?.id === workspace.teamId;
  if (!milestone) return null;
  return (
    <>
      <Paper variant="outlined" className="milestone-summary" aria-label="Sprint milestone">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="overline">Sprint milestone</Typography>
            <Typography variant="h6" component="p">
              {milestone.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {milestone.goal}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {new Date(milestone.startDate).toLocaleDateString('en-GB')} –{' '}
              {new Date(milestone.dueDate).toLocaleDateString('en-GB')}
            </Typography>
          </Box>
          <Stack spacing={1} sx={{ alignItems: { sm: 'flex-end' }, justifyContent: 'center' }}>
            <Typography variant="caption" color={milestone.isOvercapacity ? 'error' : 'success.main'}>
              {milestone.isOvercapacity ? 'Capacity needs attention' : 'Capacity on track'}
            </Typography>
            <Button
              variant="outlined"
              color={milestone.isOvercapacity ? 'error' : 'primary'}
              onClick={() => api<typeof capacity>(`milestones/${milestone.id}/capacity`).then(setCapacity)}
            >
              View capacity
            </Button>
          </Stack>
        </Stack>
      </Paper>
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
                {capacity.teamMembers.length} team members · {capacity.businessDays} business days ·{' '}
                {capacity.approvedLeaveDays} approved leave days
              </Typography>
              <Typography variant="body2" color={capacity.remainingHours < 0 ? 'error' : 'text.secondary'}>
                {capacity.remainingHours} hours remaining
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {manager && canClose && capacity && (
            <Button color="error" onClick={() => setConfirming(true)}>
              Complete sprint
            </Button>
          )}
          <Button onClick={() => setCapacity(undefined)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={confirming} onClose={() => setConfirming(false)} fullWidth maxWidth="xs">
        <DialogTitle>Complete this sprint?</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning">
            Completing the sprint closes its milestone and makes this board read-only. Tasks and activity history remain
            available under Past sprints.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)}>Keep sprint open</Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              await api(`milestones/${capacity!.milestoneId}/close`, {});
              setConfirming(false);
              setCapacity(undefined);
              await refresh();
            }}
          >
            Complete sprint
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

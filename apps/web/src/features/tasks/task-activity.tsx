import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Tag } from '../hr/ui';
import type { TaskDetailResponse } from './task-detail-types';

const labels: Record<string, string> = {
  CREATE: 'Created',
  UPDATE_FIELD: 'Updated',
  COLUMN_CHANGE: 'Moved',
  DELETION: 'Deleted',
  RESTORATION: 'Restored',
};
const fieldLabels: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  priority: 'Priority',
  estimatedHours: 'Time estimate',
  assigneeId: 'Assigned employee',
  reporterId: 'Reporter',
  milestoneId: 'Milestone',
  isEscalated: 'Escalation',
  isManagementApproved: 'Director approval',
};

export function TaskActivity({ activity }: { activity: TaskDetailResponse['activity'] }) {
  return (
    <Box>
      <Typography variant="overline">Activity</Typography>
      <Stack spacing={1.25} sx={{ mt: 0.5 }}>
        {activity.map((event) => (
          <Box key={event.id} sx={{ borderLeft: '2px solid', borderColor: 'divider', pl: 1.5 }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Tag value={labels[event.actionType] ?? event.actionType} tone="grey" />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {event.actor.firstName} {event.actor.lastName}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {event.fieldChanged ? `${fieldLabels[event.fieldChanged] ?? 'Task details'} · ` : ''}
              {event.oldValue && event.newValue ? `${event.oldValue} → ${event.newValue} · ` : ''}
              {new Date(event.createdAt).toLocaleString('en-GB')}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { api } from '@/lib/api';
import type { Board } from './task-types';

export function SprintPanel({
  board,
  canManage,
  refresh,
}: {
  board: Board;
  canManage: boolean;
  refresh: () => Promise<void>;
}) {
  if (board.kind !== 'SCRUM') return null;
  return board.sprints.map((sprint) => (
    <Paper key={sprint.id} variant="outlined" sx={{ p: 2, mt: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontWeight: 800 }}>{sprint.name}</Typography>
          <Typography variant="body2">{sprint.goal}</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2">{sprint.status}</Typography>
          {canManage && sprint.status === 'PLANNED' && (
            <Button
              onClick={async () => {
                await api(`sprints/${sprint.id}/activate`, {});
                await refresh();
              }}
            >
              Activate
            </Button>
          )}
          {canManage && sprint.status === 'ACTIVE' && (
            <Button
              onClick={async () => {
                await api(`sprints/${sprint.id}/complete`, {});
                await refresh();
              }}
            >
              Complete
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  ));
}

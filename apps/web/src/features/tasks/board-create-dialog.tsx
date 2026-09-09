'use client';
import AddOutlined from '@mui/icons-material/AddOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { TaskManagementType } from '@tms/contracts';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { message } from '../hr/ui';
import type { Workspace } from './task-types';

export function BoardCreateDialog({ workspace, refresh }: { workspace: Workspace; refresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TaskManagementType>(workspace.department.taskManagementTypes[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrum = kind === 'SCRUM';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api(`task-workspaces/${workspace.id}/boards`, {
        name: String(data.get('name')),
        kind,
        milestoneGoal: scrum ? String(data.get('milestoneGoal')) : undefined,
        milestoneStartDate: scrum ? String(data.get('milestoneStartDate')) : undefined,
        milestoneDueDate: scrum ? String(data.get('milestoneDueDate')) : undefined,
      });
      setOpen(false);
      await refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outlined" startIcon={<AddOutlined />} onClick={() => setOpen(true)}>
        Create board
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={submit}>
          <DialogTitle>{scrum ? 'Create sprint board' : 'Create board'}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                select
                name="kind"
                label="Board type"
                value={kind}
                onChange={(event) => setKind(event.target.value as TaskManagementType)}
              >
                {workspace.department.taskManagementTypes.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type[0] + type.slice(1).toLowerCase()}
                  </MenuItem>
                ))}
              </TextField>
              <TextField name="name" label={scrum ? 'Sprint name' : 'Board name'} required autoFocus />
              {scrum && (
                <>
                  <TextField name="milestoneGoal" label="Sprint goal" required multiline minRows={2} />
                  <TextField
                    name="milestoneStartDate"
                    label="Start date"
                    type="date"
                    required
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    name="milestoneDueDate"
                    label="Due date"
                    type="date"
                    required
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <Alert severity="info">
                    This board represents one sprint. Its milestone uses this name, goal, and date range.
                  </Alert>
                </>
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Creating…' : scrum ? 'Create sprint board' : 'Create board'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

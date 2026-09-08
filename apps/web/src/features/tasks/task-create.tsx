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
import type { CurrentEmployee, DirectoryEmployee } from '@tms/contracts';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { message } from '../hr/ui';
import type { Workspace } from './task-types';

export function CreateTask({
  workspace,
  people,
  user,
  refresh,
}: {
  workspace: Workspace;
  people: DirectoryEmployee[];
  user: CurrentEmployee;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = new FormData(event.currentTarget);
      await api('tasks', {
        workspaceId: workspace.id,
        boardId: String(data.get('boardId')),
        title: String(data.get('title')),
        description: String(data.get('description')),
        priority: String(data.get('priority')),
        estimatedHours: Number(data.get('estimatedHours')),
        assigneeId: data.get('assigneeId') || undefined,
        reporterId: data.get('reporterId') || undefined,
        milestoneId: data.get('milestoneId') || undefined,
        definitionOfDone: String(data.get('definitionOfDone') ?? '')
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
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
      <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setOpen(true)}>
        Create task
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={submit}>
          <DialogTitle>Create a task</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField name="title" label="Task title" required autoFocus />
              <TextField name="description" label="Description" multiline minRows={3} />
              <TextField name="boardId" label="Board" select required defaultValue={workspace.boards[0]?.id}>
                {workspace.boards.map((board) => (
                  <MenuItem key={board.id} value={board.id}>
                    {board.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField name="priority" label="Priority" select required defaultValue="MEDIUM">
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
              </TextField>
              <TextField
                name="estimatedHours"
                label="Estimate in hours"
                type="number"
                required
                defaultValue={8}
                slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
              />
              <TextField name="assigneeId" label="Assignee" select defaultValue="">
                <MenuItem value="">Unassigned</MenuItem>
                {people.map((employee) => (
                  <MenuItem key={employee.id} value={employee.id}>
                    {employee.displayName}
                  </MenuItem>
                ))}
              </TextField>
              <TextField name="reporterId" label="Reporter" select defaultValue={user.id}>
                {people
                  .filter((employee) => employee.department.id === workspace.departmentId)
                  .map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.displayName}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField name="milestoneId" label="Milestone" select defaultValue="">
                <MenuItem value="">No milestone</MenuItem>
                {workspace.milestones.map((milestone) => (
                  <MenuItem key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField name="definitionOfDone" label="Definition of Done (one item per line)" multiline minRows={2} />
              {error && <Alert severity="error">{error}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Creating…' : 'Create task'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

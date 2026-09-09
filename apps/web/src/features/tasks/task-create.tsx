import AddOutlined from '@mui/icons-material/AddOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import type { CurrentEmployee, DirectoryEmployee } from '@tms/contracts';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { message } from '../hr/ui';
import type { Workspace } from './task-types';
import { TaskMarkdown } from './task-markdown';

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
  const [selectedBoardId, setSelectedBoardId] = useState(workspace.boards[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const selectedBoard = workspace.boards.find((board) => board.id === selectedBoardId);
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
        milestoneId: data.get('milestoneId') || undefined,
        sprintId: data.get('sprintId') || undefined,
        dueDate: data.get('dueDate') || undefined,
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
              <TextField
                name="description"
                label="Description"
                multiline
                minRows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                helperText="Use headings, lists, bold text, links, or code when useful."
              />
              {description.trim() && (
                <Stack spacing={0.5} className="task-description-preview">
                  <Typography variant="overline">Preview</Typography>
                  <TaskMarkdown source={description} />
                </Stack>
              )}
              <TextField
                name="boardId"
                label="Board"
                select
                required
                value={selectedBoardId}
                onChange={(event) => setSelectedBoardId(event.target.value)}
              >
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
                {people
                  .filter((employee) => employee.department?.id === workspace.departmentId)
                  .map((employee) => (
                    <MenuItem key={employee.id} value={employee.id}>
                      {employee.displayName}
                    </MenuItem>
                  ))}
              </TextField>
              <Alert severity="info">Reporter: {user.displayName}. The creator is recorded automatically.</Alert>
              <TextField name="milestoneId" label="Milestone" select defaultValue="">
                <MenuItem value="">No milestone</MenuItem>
                {workspace.milestones.map((milestone) => (
                  <MenuItem key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </MenuItem>
                ))}
              </TextField>
              {selectedBoard?.kind === 'SCRUM' && !!selectedBoard.sprints.length && (
                <TextField name="sprintId" label="Sprint" select defaultValue="">
                  <MenuItem value="">No sprint</MenuItem>
                  {selectedBoard.sprints
                    .filter((sprint) => sprint.status !== 'COMPLETED')
                    .map((sprint) => (
                      <MenuItem key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </MenuItem>
                    ))}
                </TextField>
              )}
              <TextField name="dueDate" label="Due date" type="date" slotProps={{ inputLabel: { shrink: true } }} />
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

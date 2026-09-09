import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import LinkOutlined from '@mui/icons-material/LinkOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { LoadingState, message, ModalForm, StatusTag, Tag } from '../hr/ui';
import { personName } from './task-card';
import { canManageTask, type TaskDetailProps, type TaskDetailResponse } from './task-detail-types';
import { priorityTone } from './task-types';
import { TaskActivity } from './task-activity';

export function TaskDetail({ taskId, user, columns = [], onClose, refresh, people }: TaskDetailProps) {
  const [task, setTask] = useState<TaskDetailResponse>(),
    [commentText, setCommentText] = useState(''),
    [error, setError] = useState(''),
    [blockerId, setBlockerId] = useState('');
  const load = useCallback(() => api<typeof task>(`tasks/${taskId}`).then(setTask), [taskId]);
  useEffect(() => void load(), [load]);
  if (!task)
    return (
      <Dialog open fullWidth maxWidth="sm">
        <LoadingState label="Loading task" />
      </Dialog>
    );
  async function mutate(path: string, body: unknown, method = 'POST') {
    try {
      setError('');
      await api(path, body, method);
      await load();
      await refresh();
    } catch (cause) {
      setError(message(cause));
    }
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" aria-labelledby="task-detail-title">
      <DialogTitle id="task-detail-title">
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {task.publicKey}
            </Typography>
            <Typography variant="h5" component="span" sx={{ display: 'block' }}>
              {task.title}
            </Typography>
          </Box>
          <Button aria-label="Close task" onClick={onClose} startIcon={<CloseOutlined />}>
            Close
          </Button>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <div className="task-detail-grid">
          <Stack spacing={3}>
            <Box>
              <Typography variant="overline">Description</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{task.description || 'No description yet.'}</Typography>
            </Box>
            <Box>
              <Typography variant="overline">Discussion</Typography>
              <TextField
                fullWidth
                size="small"
                label="Write a comment"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                onKeyDown={async (event) => {
                  if (event.key === 'Enter' && commentText.trim()) {
                    event.preventDefault();
                    await mutate(`tasks/${task.id}/comments`, { body: commentText });
                    setCommentText('');
                  }
                }}
              />
              {task.comments?.map((comment) => (
                <Box key={comment.id} sx={{ mt: 1.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {comment.author.firstName} {comment.author.lastName}
                  </Typography>
                  <Typography variant="body2">{comment.body}</Typography>
                </Box>
              ))}
            </Box>
            <TaskActivity activity={task.activity} />
          </Stack>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <StatusTag value={task.column.name} />
              <Tag value={task.priority} tone={priorityTone[task.priority]} />
            </Stack>
            <Typography variant="body2">
              <strong>Assignee</strong>
              <br />
              {personName(task.assignee)}
            </Typography>
            <Typography variant="body2">
              <strong>Reporter</strong>
              <br />
              {personName(task.reporter)}
            </Typography>
            <Typography variant="body2">
              <strong>Estimate</strong>
              <br />
              {task.estimatedHours} hours
            </Typography>
            <ModalForm
              buttonLabel="Edit task"
              title="Edit task details"
              fields={[
                { name: 'title', label: 'Task title', value: task.title },
                { name: 'description', label: 'Description', value: task.description, optional: true },
                {
                  name: 'priority',
                  label: 'Priority',
                  value: task.priority,
                  options: [
                    { value: 'LOW', label: 'Low' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HIGH', label: 'High' },
                  ],
                },
                { name: 'estimatedHours', label: 'Estimate in hours', type: 'number', value: task.estimatedHours },
                {
                  name: 'assigneeId',
                  label: 'Assignee',
                  optional: true,
                  value: task.assignee?.id ?? '',
                  options: [
                    { value: '', label: 'Unassigned' },
                    ...people
                      .filter((employee) => employee.department?.id === task.workspace.departmentId)
                      .map((employee) => ({ value: employee.id, label: employee.displayName })),
                  ],
                },
              ]}
              onSubmit={async (values) => {
                const assigneeId = String(values.assigneeId ?? '');
                await api(
                  `tasks/${task.id}`,
                  {
                    title: values.title,
                    description: values.description ?? '',
                    priority: values.priority,
                    estimatedHours: values.estimatedHours,
                    ...(assigneeId ? { assigneeId } : { clearAssignee: true }),
                  },
                  'PATCH',
                );
                await load();
                await refresh();
              }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel id="move-task-label">Move to</InputLabel>
              <Select
                labelId="move-task-label"
                label="Move to"
                value={task.columnId}
                onChange={(event) => mutate(`tasks/${task.id}/move`, { columnId: event.target.value })}
              >
                {(columns.length ? columns : task.board.columns).map((column) => (
                  <MenuItem key={column.id} value={column.id}>
                    {column.name}
                    {column.managementLocked ? ' · sign-off' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel id="blocker-label">Blocked by</InputLabel>
              <Select
                labelId="blocker-label"
                label="Blocked by"
                value={blockerId}
                onChange={(event) => setBlockerId(event.target.value)}
              >
                <MenuItem value="">Choose a task</MenuItem>
                {columns
                  .flatMap((column) => column.tasks)
                  .filter((candidate) => candidate.id !== task.id)
                  .map((candidate) => (
                    <MenuItem key={candidate.id} value={candidate.id}>
                      {candidate.publicKey} · {candidate.title}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<LinkOutlined />}
              disabled={!blockerId}
              onClick={() => mutate(`tasks/${task.id}/links`, { targetTaskId: blockerId, type: 'BLOCKED_BY' })}
            >
              Add blocker
            </Button>
            {canManageTask(user, task) && (
              <Button
                variant="outlined"
                startIcon={<CheckCircleOutlineOutlined />}
                onClick={() => mutate(`tasks/${task.id}/management-approval`, { approved: !task.isManagementApproved })}
              >
                {task.isManagementApproved ? 'Remove sign-off' : 'Sign off task'}
              </Button>
            )}
            {(canManageTask(user, task) || task.reporter.id === user.id) && (
              <Button
                color="error"
                variant="text"
                startIcon={<DeleteOutlineOutlined />}
                onClick={async () => {
                  await api(`tasks/${task.id}`, undefined, 'DELETE');
                  await refresh();
                  onClose();
                }}
              >
                Archive task
              </Button>
            )}
            {canManageTask(user, task) && (
              <Button
                variant="outlined"
                startIcon={<FlagOutlined />}
                onClick={() => mutate(`tasks/${task.id}/escalation`, { escalated: !task.isEscalated })}
              >
                {task.isEscalated ? 'Clear escalation' : 'Escalate'}
              </Button>
            )}
          </Stack>
        </div>
      </DialogContent>
    </Dialog>
  );
}

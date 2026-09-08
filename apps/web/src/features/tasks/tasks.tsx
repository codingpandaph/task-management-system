'use client';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import LinkOutlined from '@mui/icons-material/LinkOutlined';
import RestoreOutlined from '@mui/icons-material/RestoreOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee, DirectoryEmployee, TaskColumnContract, TaskContract } from '@tms/contracts';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { EmptyState, LoadingState, message, ModalForm, StatusTag, Tag } from '../hr/ui';

type Board = { id: string; name: string; kind: string; columns: TaskColumnContract[] };
type Milestone = { id: string; name: string; goal: string; dueDate: string; isOvercapacity: boolean };
type Workspace = {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  function: string;
  boards: Board[];
  milestones: Milestone[];
  memberships: { employeeId: string; canCreateTasks: boolean; canCreateBoards: boolean }[];
};
type BoardResponse = { workspace: Workspace; board: Board };
type Report = {
  id: string;
  code: string;
  name: string;
  total: number;
  completed: number;
  unassigned: number;
  escalated: number;
  estimatedHours: number;
  openMilestones: number;
};
type DepartmentOption = { id: string; name: string; code: string; status: string };
const priorityTone = { LOW: 'grey', MEDIUM: 'blue', HIGH: 'red' } as const;

function personName(person: TaskContract['assignee']) {
  return person ? `${person.firstName} ${person.lastName}` : 'Unassigned';
}

function TaskCard({ task, open }: { task: TaskContract; open: () => void }) {
  return (
    <button className="task-card" onClick={open} aria-label={`Open ${task.publicKey} ${task.title}`}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          {task.publicKey}
        </Typography>
        <Tag value={task.priority} tone={priorityTone[task.priority]} />
      </Stack>
      <Typography sx={{ fontWeight: 700, mt: 1, textAlign: 'left' }}>{task.title}</Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1.5 }}>
        <span className="task-avatar">{personName(task.assignee).slice(0, 1)}</span>
        <Typography variant="caption" color="text.secondary" noWrap>
          {personName(task.assignee)} · {task.estimatedHours}h
        </Typography>
      </Stack>
      {(task.isEscalated || task.isManagementApproved) && (
        <Stack direction="row" spacing={0.75} sx={{ mt: 1.5 }}>
          {task.isEscalated && <Tag value="ESCALATED" tone="amber" />}
          {task.isManagementApproved && <Tag value="SIGNED_OFF" tone="green" />}
        </Stack>
      )}
    </button>
  );
}

function TaskDetail({
  taskId,
  user,
  columns,
  onClose,
  refresh,
  people,
}: {
  taskId: string;
  user: CurrentEmployee;
  columns: TaskColumnContract[];
  onClose: () => void;
  refresh: () => Promise<void>;
  people: DirectoryEmployee[];
}) {
  const [task, setTask] = useState<
    TaskContract & {
      board: { id: string; name: string; columns: Omit<TaskColumnContract, 'tasks'>[] };
      comments: { id: string; body: string; author: { firstName: string; lastName: string } }[];
    }
  >();
  const [dodText, setDodText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [error, setError] = useState('');
  const [blockerId, setBlockerId] = useState('');
  const load = useCallback(() => api<typeof task>(`tasks/${taskId}`).then(setTask), [taskId]);
  useEffect(() => void load(), [load]);
  if (!task)
    return (
      <Dialog open fullWidth maxWidth="sm">
        <LoadingState label="Loading task" />
      </Dialog>
    );
  const availableColumns = columns.length ? columns : task.board.columns;
  const manager =
    user.position === 'SENIOR_DIRECTOR' ||
    (user.position === 'ACCOUNT_DIRECTOR' && user.department.id === task.workspace.departmentId);
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
              <Typography variant="overline">Definition of done</Typography>
              {task.definitionOfDone.length ? (
                task.definitionOfDone.map((item) => (
                  <Stack key={item.id} direction="row" sx={{ alignItems: 'center' }}>
                    <Checkbox
                      checked={item.isChecked}
                      onChange={(event) =>
                        mutate(
                          `tasks/${task.id}/definition-of-done/${item.id}`,
                          { isChecked: event.target.checked },
                          'PATCH',
                        )
                      }
                      slotProps={{ input: { 'aria-label': item.item } }}
                    />
                    <Typography sx={{ textDecoration: item.isChecked ? 'line-through' : 'none' }}>
                      {item.item}
                    </Typography>
                  </Stack>
                ))
              ) : (
                <Typography color="text.secondary">No completion checks.</Typography>
              )}
              <TextField
                size="small"
                label="Add completion check"
                sx={{ mt: 1 }}
                value={dodText}
                onChange={(event) => setDodText(event.target.value)}
                onKeyDown={async (event) => {
                  if (event.key === 'Enter' && dodText.trim()) {
                    event.preventDefault();
                    await mutate(`tasks/${task.id}/definition-of-done`, { item: dodText });
                    setDodText('');
                  }
                }}
              />
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
                    ...people.map((employee) => ({ value: employee.id, label: employee.displayName })),
                  ],
                },
                {
                  name: 'reporterId',
                  label: 'Reporter',
                  value: task.reporter.id,
                  options: people
                    .filter((employee) => employee.department.id === task.workspace.departmentId)
                    .map((employee) => ({ value: employee.id, label: employee.displayName })),
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
                    reporterId: values.reporterId,
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
                {availableColumns.map((column) => (
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
            {manager && (
              <Button
                variant="outlined"
                startIcon={<CheckCircleOutlineOutlined />}
                onClick={() => mutate(`tasks/${task.id}/management-approval`, { approved: !task.isManagementApproved })}
              >
                {task.isManagementApproved ? 'Remove sign-off' : 'Sign off task'}
              </Button>
            )}
            {(manager || task.reporter.id === user.id) && (
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
                Delete task
              </Button>
            )}
            {manager && (
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

function CreateTask({
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

function WorkspaceActions({
  workspace,
  user,
  people,
  refresh,
}: {
  workspace: Workspace;
  user: CurrentEmployee;
  people: DirectoryEmployee[];
  refresh: () => Promise<void>;
}) {
  const manager =
    user.position === 'SENIOR_DIRECTOR' ||
    (user.position === 'ACCOUNT_DIRECTOR' && user.department.id === workspace.departmentId);
  const canCreateBoards = manager || workspace.memberships.some((membership) => membership.canCreateBoards);
  if (!canCreateBoards) return null;
  return (
    <Box className="workspace-actions">
      {manager && (
        <ModalForm
          buttonLabel="New milestone"
          title="Create milestone"
          fields={[
            { name: 'name', label: 'Milestone name' },
            { name: 'goal', label: 'Goal' },
            { name: 'startDate', label: 'Start date', type: 'date' },
            { name: 'dueDate', label: 'Due date and time', type: 'datetime-local' },
          ]}
          onSubmit={async (values) => {
            await api(`task-workspaces/${workspace.id}/milestones`, values);
            await refresh();
          }}
        />
      )}
      <ModalForm
        buttonLabel="New board"
        title="Create Kanban board"
        description="Creates a clear To do, In progress, Review, and management-locked Done workflow."
        fields={[{ name: 'name', label: 'Board name' }]}
        onSubmit={async (values) => {
          await api(`task-workspaces/${workspace.id}/boards`, {
            name: values.name,
            kind: 'KANBAN',
            columns: [
              { name: 'To do' },
              { name: 'In progress' },
              { name: 'Review' },
              { name: 'Done', isDone: true, managementLocked: true },
            ],
          });
          await refresh();
        }}
      />
      {manager && (
        <ModalForm
          buttonLabel="Add collaborator"
          title="Add workspace collaborator"
          fields={[
            {
              name: 'employeeId',
              label: 'Active employee',
              options: people.map((employee) => ({ value: employee.id, label: employee.displayName })),
            },
            {
              name: 'milestoneId',
              label: 'Milestone scope',
              optional: true,
              options: [
                { value: '', label: 'Entire workspace' },
                ...workspace.milestones.map((milestone) => ({ value: milestone.id, label: milestone.name })),
              ],
            },
            {
              name: 'canCreateTasks',
              label: 'Can create tickets',
              value: 'true',
              options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ],
            },
            {
              name: 'canCreateBoards',
              label: 'Can create boards',
              value: 'false',
              options: [
                { value: 'false', label: 'No' },
                { value: 'true', label: 'Yes' },
              ],
            },
          ]}
          onSubmit={async (values) => {
            await api(`task-workspaces/${workspace.id}/memberships`, {
              ...values,
              canCreateTasks: values.canCreateTasks === 'true',
              canCreateBoards: values.canCreateBoards === 'true',
            });
            await refresh();
          }}
        />
      )}
    </Box>
  );
}

function MilestoneStrip({
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

export function TaskScreens({ path, user }: { path: string; user: CurrentEmployee }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [workspaceId, setWorkspaceId] = useState(''),
    [boardId, setBoardId] = useState(''),
    [board, setBoard] = useState<BoardResponse>(),
    [mine, setMine] = useState<TaskContract[]>([]),
    [reports, setReports] = useState<Report[]>([]),
    [archived, setArchived] = useState<TaskContract[]>([]),
    [people, setPeople] = useState<DirectoryEmployee[]>([]),
    [departments, setDepartments] = useState<DepartmentOption[]>([]),
    [selected, setSelected] = useState<string>(),
    [search, setSearch] = useState(''),
    [statusFilter, setStatusFilter] = useState('ALL'),
    [priorityFilter, setPriorityFilter] = useState('ALL'),
    [assigneeFilter, setAssigneeFilter] = useState('ALL'),
    [reportSearch, setReportSearch] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const loadWorkspaces = useCallback(async () => {
    const value = await api<Workspace[]>('task-workspaces');
    setWorkspaces(value);
    setWorkspaceId((current) => current || value[0]?.id || '');
    setPeople((await api<{ items: DirectoryEmployee[] }>('directory/employees?pageSize=100')).items);
    if (user.position === 'SENIOR_DIRECTOR') setDepartments(await api<DepartmentOption[]>('departments'));
  }, [user.position]);
  const loadBoard = useCallback(async () => {
    if (!workspaceId) return;
    const value = await api<BoardResponse>(
      `task-workspaces/${workspaceId}/board${boardId ? `?boardId=${boardId}` : ''}`,
    );
    setBoard(value);
    setBoardId(value.board.id);
  }, [workspaceId, boardId]);
  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      setError('');
      Promise.all([
        loadWorkspaces(),
        api<TaskContract[]>('tasks/mine').then(setMine),
        api<Report[]>('tasks/reporting').then(setReports),
        ...(path === '/task-archive' ? [api<TaskContract[]>('tasks/archived').then(setArchived)] : []),
      ])
        .catch((cause) => setError(message(cause)))
        .finally(() => setLoading(false));
    });
  }, [loadWorkspaces, path]);
  useEffect(() => {
    queueMicrotask(() => void loadBoard());
  }, [loadBoard]);
  const filteredMine = useMemo(
    () =>
      mine.filter(
        (task) =>
          `${task.publicKey} ${task.title} ${task.workspace.name}`.toLowerCase().includes(search.toLowerCase()) &&
          (statusFilter === 'ALL' || task.column.name === statusFilter) &&
          (priorityFilter === 'ALL' || task.priority === priorityFilter),
      ),
    [mine, priorityFilter, search, statusFilter],
  );
  async function refresh() {
    await Promise.all([
      loadWorkspaces(),
      loadBoard(),
      api<TaskContract[]>('tasks/mine').then(setMine),
      api<Report[]>('tasks/reporting').then(setReports),
      ...(path === '/task-archive' ? [api<TaskContract[]>('tasks/archived').then(setArchived)] : []),
    ]);
  }
  if (loading) return <LoadingState label="Loading work" />;
  if (error)
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" startIcon={<RefreshOutlined />} onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  if (path === '/task-reports')
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
          value={reportSearch}
          onChange={(event) => setReportSearch(event.target.value)}
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
            .filter((report) => `${report.name} ${report.code}`.toLowerCase().includes(reportSearch.toLowerCase()))
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
        {!reports.some((report) =>
          `${report.name} ${report.code}`.toLowerCase().includes(reportSearch.toLowerCase()),
        ) && <EmptyState title="No matching departments" detail="Try a department name or code." />}
      </Stack>
    );
  if (path === '/task-archive')
    return (
      <Stack spacing={3}>
        <Paper variant="outlined" className="task-hero">
          <Box>
            <Typography variant="h5" component="h2">
              Task archive
            </Typography>
            <Typography color="text.secondary">Restore deleted team work without losing its history.</Typography>
          </Box>
          <Tag value={`${archived.length} ARCHIVED`} tone="grey" />
        </Paper>
        {archived.length ? (
          <div className="my-task-grid">
            {archived.map((task) => (
              <Paper key={task.id} variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {task.publicKey}
                </Typography>
                <Typography sx={{ fontWeight: 700, my: 1 }}>{task.title}</Typography>
                <Button
                  startIcon={<RestoreOutlined />}
                  onClick={async () => {
                    await api(`tasks/${task.id}/restore`, {});
                    await refresh();
                  }}
                >
                  Restore task
                </Button>
              </Paper>
            ))}
          </div>
        ) : (
          <EmptyState title="Archive is empty" detail="Deleted tasks appear here for workspace managers." />
        )}
      </Stack>
    );
  if (path === '/tasks')
    return (
      <Stack spacing={3}>
        <Paper variant="outlined" className="task-hero">
          <Box>
            <Typography variant="h5" component="h2">
              My focus
            </Typography>
            <Typography color="text.secondary">Every task assigned to you, across department workspaces.</Typography>
          </Box>
          <Tag value={`${mine.length} TASKS`} tone="blue" />
        </Paper>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} useFlexGap sx={{ alignItems: { lg: 'center' } }}>
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            label="Search my tasks"
            size="small"
            sx={{ minWidth: { md: 320 } }}
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
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="ALL">All statuses</MenuItem>
            {Array.from(new Set(mine.map((task) => task.column.name))).map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="ALL">All priorities</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
            <MenuItem value="MEDIUM">Medium</MenuItem>
            <MenuItem value="LOW">Low</MenuItem>
          </TextField>
          {(search || statusFilter !== 'ALL' || priorityFilter !== 'ALL') && (
            <Button
              startIcon={<FilterAltOffOutlined />}
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
              }}
            >
              Clear filters
            </Button>
          )}
        </Stack>
        {filteredMine.length ? (
          <div className="my-task-grid">
            {filteredMine.map((task) => (
              <TaskCard key={task.id} task={task} open={() => setSelected(task.id)} />
            ))}
          </div>
        ) : (
          <EmptyState title="No matching tasks" detail="Assigned work will appear here." />
        )}
        {selected && (
          <TaskDetail
            taskId={selected}
            user={user}
            columns={[]}
            people={people}
            onClose={() => setSelected(undefined)}
            refresh={refresh}
          />
        )}
      </Stack>
    );
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const workspaceManager =
    !!workspace &&
    (user.position === 'SENIOR_DIRECTOR' ||
      (user.position === 'ACCOUNT_DIRECTOR' && user.department.id === workspace.departmentId));
  const canCreateTasks = workspaceManager || !!workspace?.memberships.some((membership) => membership.canCreateTasks);
  return (
    <Stack spacing={3}>
      <Paper variant="outlined" className="task-hero">
        <Box>
          <Typography variant="h5" component="h2">
            Team workspace
          </Typography>
          <Typography color="text.secondary">
            Plan milestones, track delivery, and surface work that needs attention.
          </Typography>
        </Box>
        {workspace && (
          <Stack spacing={1.25} sx={{ alignItems: { xs: 'stretch', md: 'flex-end' } }}>
            {canCreateTasks && <CreateTask workspace={workspace} people={people} user={user} refresh={refresh} />}
            <WorkspaceActions workspace={workspace} user={user} people={people} refresh={refresh} />
          </Stack>
        )}
        {user.position === 'SENIOR_DIRECTOR' &&
          departments.some((department) => !workspaces.some((item) => item.departmentId === department.id)) && (
            <ModalForm
              buttonLabel="Provision workspace"
              title="Provision a department workspace"
              fields={[
                {
                  name: 'departmentId',
                  label: 'Department',
                  options: departments
                    .filter((department) => !workspaces.some((item) => item.departmentId === department.id))
                    .map((department) => ({ value: department.id, label: department.name })),
                },
                {
                  name: 'function',
                  label: 'Operating model',
                  options: [
                    { value: 'ENGINEERING_PRODUCT', label: 'Engineering / Product' },
                    { value: 'MARKETING_CREATIVE', label: 'Marketing / Creative' },
                    { value: 'SALES_ACCOUNT_MANAGEMENT', label: 'Sales / Account Management' },
                    { value: 'HR_OPERATIONS', label: 'HR / Operations' },
                    { value: 'FINANCE_LEGAL', label: 'Finance / Legal' },
                  ],
                },
              ]}
              onSubmit={async (values) => {
                await api('task-workspaces', values);
                await refresh();
              }}
            />
          )}
      </Paper>
      {workspaces.length ? (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            select
            label="Workspace"
            value={workspaceId}
            onChange={(event) => {
              setWorkspaceId(event.target.value);
              setBoardId('');
            }}
            sx={{ minWidth: 240 }}
          >
            {workspaces.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name}
              </MenuItem>
            ))}
          </TextField>
          <Tabs
            value={boardId || false}
            onChange={(_, value) => setBoardId(value)}
            variant="scrollable"
            aria-label="Workspace boards"
          >
            {workspace?.boards.map((item) => (
              <Tab key={item.id} value={item.id} label={item.name} />
            ))}
          </Tabs>
        </Stack>
      ) : (
        <EmptyState
          title="No task workspace"
          detail="The Senior Director can provision a workspace from an active department."
        />
      )}
      {workspace && <MilestoneStrip workspace={workspace} user={user} refresh={refresh} />}
      {board && (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} useFlexGap sx={{ alignItems: { lg: 'center' } }}>
          <TextField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            label="Search tasks"
            size="small"
            sx={{ minWidth: { md: 300 } }}
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
          <TextField
            select
            size="small"
            label="Priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="ALL">All priorities</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
            <MenuItem value="MEDIUM">Medium</MenuItem>
            <MenuItem value="LOW">Low</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Assignee"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="ALL">All assignees</MenuItem>
            <MenuItem value="UNASSIGNED">Unassigned</MenuItem>
            {people
              .filter((person) => person.department.id === workspace?.departmentId)
              .map((person) => (
                <MenuItem key={person.id} value={person.id}>
                  {person.displayName}
                </MenuItem>
              ))}
          </TextField>
          {(search || priorityFilter !== 'ALL' || assigneeFilter !== 'ALL') && (
            <Button
              startIcon={<FilterAltOffOutlined />}
              onClick={() => {
                setSearch('');
                setPriorityFilter('ALL');
                setAssigneeFilter('ALL');
              }}
            >
              Clear filters
            </Button>
          )}
        </Stack>
      )}
      {board && (
        <div className="kanban" aria-label={`${board.board.name} board`}>
          {board.board.columns.map((column) => (
            <section className="kanban-column" key={column.id}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {column.name}
                </Typography>
                <span className="task-count">
                  {
                    column.tasks.filter(
                      (task) =>
                        `${task.publicKey} ${task.title}`.toLowerCase().includes(search.toLowerCase()) &&
                        (priorityFilter === 'ALL' || task.priority === priorityFilter) &&
                        (assigneeFilter === 'ALL' ||
                          (assigneeFilter === 'UNASSIGNED' ? !task.assignee : task.assignee?.id === assigneeFilter)),
                    ).length
                  }
                </span>
              </Stack>
              <Stack spacing={1.5}>
                {column.tasks
                  .filter(
                    (task) =>
                      `${task.publicKey} ${task.title}`.toLowerCase().includes(search.toLowerCase()) &&
                      (priorityFilter === 'ALL' || task.priority === priorityFilter) &&
                      (assigneeFilter === 'ALL' ||
                        (assigneeFilter === 'UNASSIGNED' ? !task.assignee : task.assignee?.id === assigneeFilter)),
                  )
                  .map((task) => (
                    <TaskCard key={task.id} task={task} open={() => setSelected(task.id)} />
                  ))}
                {!column.tasks.some(
                  (task) =>
                    `${task.publicKey} ${task.title}`.toLowerCase().includes(search.toLowerCase()) &&
                    (priorityFilter === 'ALL' || task.priority === priorityFilter) &&
                    (assigneeFilter === 'ALL' ||
                      (assigneeFilter === 'UNASSIGNED' ? !task.assignee : task.assignee?.id === assigneeFilter)),
                ) && (
                  <Typography variant="body2" color="text.secondary">
                    No matching tasks
                  </Typography>
                )}
              </Stack>
            </section>
          ))}
        </div>
      )}
      {selected && board && (
        <TaskDetail
          taskId={selected}
          user={user}
          columns={board.board.columns}
          people={people}
          onClose={() => setSelected(undefined)}
          refresh={refresh}
        />
      )}
    </Stack>
  );
}

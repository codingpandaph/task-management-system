import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee, DirectoryEmployee } from '@tms/contracts';
import { api } from '@/lib/api';
import { EmptyState, ModalForm } from '../hr/ui';
import { CreateTask } from './task-create';
import { TaskCard } from './task-card';
import { TaskDetail } from './task-detail';
import { MilestoneStrip } from './milestone-strip';
import type { BoardResponse, DepartmentOption, Workspace } from './task-types';
import { WorkspaceActions } from './workspace-actions';

interface TaskBoardViewProps {
  assigneeFilter: string;
  board?: BoardResponse;
  boardId: string;
  departments: DepartmentOption[];
  people: DirectoryEmployee[];
  priorityFilter: string;
  refresh: () => Promise<void>;
  search: string;
  selected?: string;
  setAssigneeFilter: (value: string) => void;
  setBoardId: (value: string) => void;
  setPriorityFilter: (value: string) => void;
  setSearch: (value: string) => void;
  setSelected: (value?: string) => void;
  setWorkspaceId: (value: string) => void;
  user: CurrentEmployee;
  workspaceId: string;
  workspaces: Workspace[];
}

export function TaskBoardView(props: TaskBoardViewProps) {
  const {
    assigneeFilter,
    board,
    boardId,
    departments,
    people,
    priorityFilter,
    refresh,
    search,
    selected,
    setAssigneeFilter,
    setBoardId,
    setPriorityFilter,
    setSearch,
    setSelected,
    setWorkspaceId,
    user,
    workspaceId,
    workspaces,
  } = props;
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const workspaceManager =
    !!workspace &&
    (user.position === 'SENIOR_DIRECTOR' ||
      (user.position === 'ACCOUNT_DIRECTOR' && user.department?.id === workspace.departmentId));
  const canCreateTasks =
    workspaceManager ||
    !!workspace?.memberships.some((membership) => membership.employeeId === user.id && membership.canCreateTasks);
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
              .filter((person) => person.department?.id === workspace?.departmentId)
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

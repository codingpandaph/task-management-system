import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import EastOutlined from '@mui/icons-material/EastOutlined';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee, DirectoryEmployee } from '@tms/contracts';
import { EmptyState } from '../hr/ui';
import { CreateTask } from './task-create';
import { TaskDetail } from './task-detail';
import { KanbanBoard } from './kanban-board';
import { ListBoard } from './list-board';
import { MilestoneStrip } from './milestone-strip';
import type { BoardResponse, DepartmentOption, Workspace } from './task-types';
import { WorkspaceActions } from './workspace-actions';
import { SprintHistory } from './sprint-history';
import { TaskProductActions } from './task-product-actions';
import { TaskBoardFilters } from './task-board-filters';
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
  const selectedBoard = workspace?.boards.find((item) => item.id === boardId);
  const workspaceManager = !!workspace && user.position === 'ACCOUNT_DIRECTOR' && user.team?.id === workspace.teamId;
  const readOnlyOversight =
    user.position === 'MANAGING_DIRECTOR' ||
    (user.position === 'SENIOR_DIRECTOR' && user.department?.id === workspace?.departmentId);
  const canCreateTasks =
    workspaceManager ||
    !!workspace?.memberships.some((membership) => membership.employeeId === user.id && membership.canCreateTasks);
  return (
    <Stack spacing={3}>
      {workspaces.length && workspace ? (
        <Paper variant="outlined" className="task-board-surface">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} className="task-board-toolbar">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography component="h2" variant="h6">
                {board?.board.name ?? 'Choose a board'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {workspace.department.name} · {workspace.team.name} ·{' '}
                {board?.board.kind === 'LIST' ? 'A focused task list.' : 'Drag tickets between workflow stages.'}
              </Typography>
            </Box>
            <Box className="workspace-actions">
              {canCreateTasks && board?.board.status === 'ACTIVE' && (
                <CreateTask
                  key={`${workspace.id}:${boardId}`}
                  initialBoardId={boardId}
                  workspace={workspace}
                  people={people}
                  user={user}
                  refresh={refresh}
                />
              )}
              <WorkspaceActions workspace={workspace} user={user} refresh={refresh} />
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} className="task-board-navigation">
            <TextField
              select
              label="Team"
              value={workspaceId}
              onChange={(event) => {
                setWorkspaceId(event.target.value);
                setBoardId('');
                setSearch('');
                setPriorityFilter('ALL');
                setAssigneeFilter('ALL');
              }}
              sx={{ minWidth: 240 }}
            >
              {workspaces.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.department.name} · {item.team.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Board"
              value={boardId}
              onChange={(event) => {
                setBoardId(event.target.value);
                setSearch('');
                setPriorityFilter('ALL');
                setAssigneeFilter('ALL');
              }}
              sx={{ minWidth: 260, flex: 1 }}
            >
              {workspace.boards
                .filter((item) => item.status === 'ACTIVE')
                .map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.kind === 'SCRUM' ? `Sprint · ${item.name}` : item.name}
                  </MenuItem>
                ))}
              {boardId && selectedBoard?.status !== 'ACTIVE' && (
                <MenuItem value={boardId}>Completed · {selectedBoard?.name ?? board?.board.name ?? 'Sprint'}</MenuItem>
              )}
            </TextField>
            <SprintHistory boards={workspace.boards} select={setBoardId} />
          </Stack>
          {board?.board.status === 'INACTIVE' && (
            <Alert severity="info">This sprint is complete. Its board is read-only.</Alert>
          )}
          {readOnlyOversight && board?.board.status === 'ACTIVE' && (
            <Alert severity="info">
              Leadership oversight · You can review this team’s board, sprint capacity, and delivery reports. Workflow
              changes stay with the team.
            </Alert>
          )}
          {board?.board.kind === 'SCRUM' && (
            <MilestoneStrip
              workspace={workspace}
              milestone={board.board.milestone}
              canClose={board.board.status === 'ACTIVE'}
              user={user}
              refresh={refresh}
            />
          )}
          {board?.board.kind === 'KANBAN' && (
            <Box className="wip-summary">
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                In progress · maximum {workspace.team.kanbanWipLimit} per person
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {board.wip
                  .map((person) => `${person.firstName} ${person.lastName} ${person.used}/${person.limit}`)
                  .join(' · ')}
              </Typography>
            </Box>
          )}
          {board && (
            <TaskBoardFilters
              boardName={board.board.name}
              teamId={workspace.teamId}
              people={people}
              search={search}
              priority={priorityFilter}
              assignee={assigneeFilter}
              setSearch={setSearch}
              setPriority={setPriorityFilter}
              setAssignee={setAssigneeFilter}
            />
          )}
          {board && (
            <details className="board-tools">
              <summary>Saved views and bulk actions</summary>
              <TaskProductActions
                board={board}
                search={search}
                priority={priorityFilter}
                assignee={assigneeFilter}
                people={people}
                setSearch={setSearch}
                setPriority={setPriorityFilter}
                setAssignee={setAssigneeFilter}
                refresh={refresh}
                readOnly={readOnlyOversight || board.board.status === 'INACTIVE'}
              />
            </details>
          )}
          {board && board.board.kind !== 'LIST' && (
            <>
              <Typography className="board-scroll-hint" variant="caption">
                Swipe to see every stage <EastOutlined aria-hidden="true" />
              </Typography>
              <KanbanBoard
                board={board}
                search={search}
                priorityFilter={priorityFilter}
                assigneeFilter={assigneeFilter}
                selectTask={setSelected}
                refresh={refresh}
                readOnly={readOnlyOversight || board.board.status === 'INACTIVE'}
              />
            </>
          )}
          {board && board.board.kind === 'LIST' && (
            <ListBoard
              board={board}
              tasks={board.board.columns
                .flatMap((column) => column.tasks)
                .filter(
                  (task) =>
                    `${task.publicKey} ${task.title}`.toLowerCase().includes(search.toLowerCase()) &&
                    (priorityFilter === 'ALL' || task.priority === priorityFilter) &&
                    (assigneeFilter === 'ALL' ||
                      (assigneeFilter === 'UNASSIGNED' ? !task.assignee : task.assignee?.id === assigneeFilter)),
                )}
              selectTask={setSelected}
            />
          )}
        </Paper>
      ) : (
        <Stack spacing={2}>
          <EmptyState
            title="No task workspace"
            detail="Create a team from the department page to provision its private workspace."
          />
        </Stack>
      )}
      {selected && board && (
        <TaskDetail
          taskId={selected}
          user={user}
          people={people}
          readOnly={readOnlyOversight || board?.board.status === 'INACTIVE'}
          onClose={() => setSelected(undefined)}
          refresh={refresh}
        />
      )}
    </Stack>
  );
}

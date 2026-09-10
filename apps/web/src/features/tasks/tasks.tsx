'use client';
import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import RestoreOutlined from '@mui/icons-material/RestoreOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee, DirectoryEmployee, TaskContract } from '@tms/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, EmptyState, LoadingState, message, Tag } from '../hr/ui';
import { TaskBoardView } from './task-board-view';
import { ListBoard } from './list-board';
import { TaskDetail } from './task-detail';
import { TaskReportsView } from './task-reports-view';
import type { BoardResponse, DepartmentOption, TaskReport, Workspace } from './task-types';

export function TaskScreens({ path, user }: { path: string; user: CurrentEmployee }) {
  const searchParams = useSearchParams();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [workspaceId, setWorkspaceId] = useState(''),
    [boardId, setBoardId] = useState(''),
    [board, setBoard] = useState<BoardResponse>(),
    [mine, setMine] = useState<TaskContract[]>([]),
    [reports, setReports] = useState<TaskReport[]>([]),
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
    if (['MANAGING_DIRECTOR', 'SENIOR_DIRECTOR'].includes(user.position))
      setDepartments(await api<DepartmentOption[]>('departments'));
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
        ...(path === '/task-reports' ? [api<TaskReport[]>('tasks/reporting').then(setReports)] : []),
        ...(path === '/task-archive' ? [api<TaskContract[]>('tasks/archived').then(setArchived)] : []),
      ])
        .catch((cause) => setError(message(cause)))
        .finally(() => setLoading(false));
    });
  }, [loadWorkspaces, path]);
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (!taskId) return;
    void api<TaskContract>(`tasks/${taskId}`).then((task) => {
      setWorkspaceId(task.workspace.id);
      setBoardId(task.boardId);
      setSelected(task.id);
    });
  }, [searchParams]);
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
      ...(path === '/task-reports' ? [api<TaskReport[]>('tasks/reporting').then(setReports)] : []),
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
    return <TaskReportsView reports={reports} search={reportSearch} setSearch={setReportSearch} />;
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
      <Card title="Assigned to me" actions={<Tag value={`${mine.length} TASKS`} tone="blue" />}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Every task assigned to you, across your team workspaces.
        </Typography>
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
          <ListBoard tasks={filteredMine} selectTask={setSelected} />
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
      </Card>
    );
  return (
    <TaskBoardView
      assigneeFilter={assigneeFilter}
      board={board}
      boardId={boardId}
      departments={departments}
      people={people}
      priorityFilter={priorityFilter}
      refresh={refresh}
      search={search}
      selected={selected}
      setAssigneeFilter={setAssigneeFilter}
      setBoardId={setBoardId}
      setPriorityFilter={setPriorityFilter}
      setSearch={setSearch}
      setSelected={setSelected}
      setWorkspaceId={setWorkspaceId}
      user={user}
      workspaceId={workspaceId}
      workspaces={workspaces}
    />
  );
}

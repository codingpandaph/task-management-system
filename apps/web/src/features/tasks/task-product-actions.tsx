'use client';
import BookmarkAddOutlined from '@mui/icons-material/BookmarkAddOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import PlaylistAddCheckOutlined from '@mui/icons-material/PlaylistAddCheckOutlined';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ModalForm } from '../hr/ui';
import type { BoardResponse } from './task-types';

type SavedView = {
  id: string;
  name: string;
  filters: { search: string; priority: string; assigneeId: string };
};
type Props = {
  board: BoardResponse;
  search: string;
  priority: string;
  assignee: string;
  people: { id: string; displayName: string; department: { id: string } | null }[];
  setSearch: (value: string) => void;
  setPriority: (value: string) => void;
  setAssignee: (value: string) => void;
  refresh: () => Promise<void>;
};

export function TaskProductActions(props: Props) {
  const { board, search, priority, assignee, people, setSearch, setPriority, setAssignee, refresh } = props;
  const [views, setViews] = useState<SavedView[]>([]),
    [selectedView, setSelectedView] = useState('');
  const workspaceId = board.workspace.id;
  const loadViews = useCallback(
    () => api<SavedView[]>(`task-views?workspaceId=${workspaceId}`).then(setViews),
    [workspaceId],
  );
  useEffect(() => void loadViews(), [loadViews]);
  const tasks = board.board.columns.flatMap((column) => column.tasks);
  const departmentPeople = people.filter((person) => person.department?.id === board.workspace.departmentId);
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap sx={{ alignItems: { md: 'center' } }}>
      <TextField
        select
        size="small"
        label="Saved view"
        value={selectedView}
        sx={{ minWidth: 180 }}
        onChange={(event) => {
          const id = event.target.value;
          setSelectedView(id);
          const view = views.find((item) => item.id === id);
          if (view) {
            setSearch(view.filters.search);
            setPriority(view.filters.priority);
            setAssignee(view.filters.assigneeId);
          }
        }}
      >
        <MenuItem value="">Current filters</MenuItem>
        {views.map((view) => (
          <MenuItem key={view.id} value={view.id}>
            {view.name}
          </MenuItem>
        ))}
      </TextField>
      <ModalForm
        buttonLabel="Save view"
        icon={<BookmarkAddOutlined />}
        title="Save these filters"
        fields={[{ name: 'name', label: 'View name' }]}
        onSubmit={async (values) => {
          await api('task-views', {
            name: values.name,
            workspaceId,
            search,
            priority: priority === 'ALL' ? undefined : priority,
            assigneeId: assignee === 'ALL' ? undefined : assignee,
          });
          await loadViews();
        }}
      />
      {selectedView && (
        <Tooltip title="Delete saved view">
          <IconButton
            aria-label="Delete saved view"
            onClick={async () => {
              await api(`task-views/${selectedView}`, undefined, 'DELETE');
              setSelectedView('');
              await loadViews();
            }}
          >
            <DeleteOutlineOutlined />
          </IconButton>
        </Tooltip>
      )}
      <ModalForm
        buttonLabel="Bulk update"
        icon={<PlaylistAddCheckOutlined />}
        title="Update several tasks"
        fields={[
          {
            name: 'taskIds',
            label: 'Tasks',
            multiple: true,
            options: tasks.map((task) => ({ value: task.id, label: `${task.publicKey} · ${task.title}` })),
          },
          {
            name: 'priority',
            label: 'Set priority',
            optional: true,
            options: [
              { value: '', label: 'Keep current' },
              { value: 'LOW', label: 'Low' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HIGH', label: 'High' },
            ],
          },
          {
            name: 'assigneeId',
            label: 'Set assignee',
            optional: true,
            options: [
              { value: '', label: 'Keep current' },
              ...departmentPeople.map((person) => ({ value: person.id, label: person.displayName })),
            ],
          },
          {
            name: 'columnId',
            label: 'Move to',
            optional: true,
            options: [
              { value: '', label: 'Keep current' },
              ...board.board.columns.map((column) => ({ value: column.id, label: column.name })),
            ],
          },
        ]}
        onSubmit={async (values) => {
          await api(
            'tasks/bulk',
            {
              taskIds: String(values.taskIds).split(',').filter(Boolean),
              priority: values.priority || undefined,
              assigneeId: values.assigneeId || undefined,
              columnId: values.columnId || undefined,
            },
            'PATCH',
          );
          await refresh();
        }}
      />
    </Stack>
  );
}

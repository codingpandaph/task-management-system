import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TaskContract } from '@tms/contracts';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { message } from '../hr/ui';
import { TaskCard } from './task-card';
import type { BoardResponse } from './task-types';

interface KanbanBoardProps {
  assigneeFilter: string;
  board: BoardResponse;
  priorityFilter: string;
  refresh: () => Promise<void>;
  search: string;
  selectTask: (id: string) => void;
}

export function KanbanBoard(props: KanbanBoardProps) {
  const { assigneeFilter, board, priorityFilter, refresh, search, selectTask } = props;
  const [draggedId, setDraggedId] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const columns = board.board.columns;
  const visible = useMemo(
    () =>
      new Map(
        columns.map((column) => [
          column.id,
          column.tasks.filter(
            (task) =>
              `${task.publicKey} ${task.title}`.toLowerCase().includes(search.toLowerCase()) &&
              (priorityFilter === 'ALL' || task.priority === priorityFilter) &&
              (assigneeFilter === 'ALL' ||
                (assigneeFilter === 'UNASSIGNED' ? !task.assignee : task.assignee?.id === assigneeFilter)),
          ),
        ]),
      ),
    [assigneeFilter, columns, priorityFilter, search],
  );

  async function move(task: TaskContract, columnId: string) {
    if (task.column.id === columnId) return;
    const destination = columns.find((column) => column.id === columnId);
    try {
      await api(`tasks/${task.id}/move`, { columnId });
      setAnnouncement(`${task.publicKey} moved to ${destination?.name ?? 'the selected column'}.`);
      await refresh();
    } catch (cause) {
      setAnnouncement(`Could not move ${task.publicKey}. ${message(cause)}`);
    }
  }

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
      <div className="kanban" aria-label={`${board.board.name} board`}>
        {columns.map((column, columnIndex) => {
          const tasks = visible.get(column.id) ?? [];
          return (
            <section
              className={`kanban-column${targetColumn === column.id ? ' is-drop-target' : ''}`}
              key={column.id}
              aria-label={`Drop tasks in ${column.name}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setTargetColumn(column.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setTargetColumn('');
              }}
              onDrop={(event) => {
                event.preventDefault();
                const task = columns.flatMap((item) => item.tasks).find((item) => item.id === draggedId);
                setTargetColumn('');
                setDraggedId('');
                if (task) void move(task, column.id);
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800 }}>
                  {column.name}
                </Typography>
                <span className="task-count" aria-label={`${tasks.length} tasks`}>
                  {tasks.length}
                </span>
              </Stack>
              <Stack spacing={1.5}>
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    open={() => selectTask(task.id)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', task.id);
                      setDraggedId(task.id);
                    }}
                    onDragEnd={() => {
                      setDraggedId('');
                      setTargetColumn('');
                    }}
                    moveBack={columnIndex > 0 ? () => void move(task, columns[columnIndex - 1].id) : undefined}
                    moveForward={
                      columnIndex < columns.length - 1 ? () => void move(task, columns[columnIndex + 1].id) : undefined
                    }
                    previousColumn={columns[columnIndex - 1]?.name}
                    nextColumn={columns[columnIndex + 1]?.name}
                  />
                ))}
                {!tasks.length && (
                  <Typography className="kanban-empty" variant="body2" color="text.secondary">
                    Drop a task here
                  </Typography>
                )}
              </Stack>
            </section>
          );
        })}
      </div>
    </>
  );
}

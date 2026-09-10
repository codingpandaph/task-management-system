import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type { TaskContract } from '@tms/contracts';
import { SortHeader, useTableSort } from '../hr/sorting';
import { StatusTag, Tag } from '../hr/ui';
import { personName } from './task-card';
import { priorityTone, type BoardResponse } from './task-types';

export function ListBoard({
  board,
  tasks,
  selectTask,
}: {
  board?: BoardResponse;
  tasks: TaskContract[];
  selectTask: (id: string) => void;
}) {
  const sort = useTableSort('Due date');
  const ordered = sort.sorted(tasks, (task, key) => {
    switch (key) {
      case 'Task':
        return task.title;
      case 'Status':
        return task.column.name;
      case 'Assignee':
        return task.assignee ? personName(task.assignee) : null;
      case 'Reporter':
        return personName(task.reporter);
      case 'Priority':
        return { HIGH: 0, MEDIUM: 1, LOW: 2 }[task.priority];
      case 'Department':
        return task.workspace.name;
      default:
        return task.dueDate;
    }
  });
  return (
    <TableContainer tabIndex={0} role="region" aria-label="Scrollable task list">
      <Table aria-label={board ? `${board.board.name} tasks` : 'My tasks'}>
        <TableHead>
          <TableRow>
            {['Task', 'Status', ...(board ? [] : ['Department']), 'Assignee', 'Reporter', 'Priority', 'Due date'].map(
              (label) => (
                <SortHeader key={label} label={label} column={label} sort={sort} />
              ),
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {ordered.map((task) => (
            <TableRow key={task.id} hover>
              <TableCell>
                <Button
                  sx={{ textAlign: 'left', justifyContent: 'flex-start', minWidth: 180 }}
                  onClick={() => selectTask(task.id)}
                >
                  {task.publicKey} · {task.title}
                </Button>
              </TableCell>
              <TableCell>
                <StatusTag value={task.column.name} />
              </TableCell>
              {!board && <TableCell>{task.workspace.name}</TableCell>}
              <TableCell>{personName(task.assignee)}</TableCell>
              <TableCell>{personName(task.reporter)}</TableCell>
              <TableCell>
                <Tag value={task.priority} tone={priorityTone[task.priority]} />
              </TableCell>
              <TableCell>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB') : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type { TaskContract } from '@tms/contracts';
import { StatusTag, Tag } from '../hr/ui';
import { personName } from './task-card';
import { priorityTone, type BoardResponse } from './task-types';

export function ListBoard({
  board,
  tasks,
  selectTask,
}: {
  board: BoardResponse;
  tasks: TaskContract[];
  selectTask: (id: string) => void;
}) {
  return (
    <TableContainer>
      <Table aria-label={`${board.board.name} tasks`}>
        <TableHead>
          <TableRow>
            <TableCell>Task</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Assignee</TableCell>
            <TableCell>Reporter</TableCell>
            <TableCell>Priority</TableCell>
            <TableCell>Due date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} hover>
              <TableCell>
                <Button onClick={() => selectTask(task.id)}>{task.title}</Button>
              </TableCell>
              <TableCell>
                <StatusTag value={task.column.name} />
              </TableCell>
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

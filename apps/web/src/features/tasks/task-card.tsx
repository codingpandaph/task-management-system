import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import DragIndicatorOutlined from '@mui/icons-material/DragIndicatorOutlined';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TaskContract } from '@tms/contracts';
import type { DragEventHandler } from 'react';
import { Tag } from '../hr/ui';
import { priorityTone } from './task-types';

export function personName(person: TaskContract['assignee']) {
  return person ? `${person.firstName} ${person.lastName}` : 'Unassigned';
}

interface TaskCardProps {
  moveBack?: () => void;
  moveForward?: () => void;
  nextColumn?: string;
  onDragEnd?: DragEventHandler<HTMLElement>;
  onDragStart?: DragEventHandler<HTMLElement>;
  open: () => void;
  previousColumn?: string;
  task: TaskContract;
}

export function TaskCard(props: TaskCardProps) {
  const { moveBack, moveForward, nextColumn, onDragEnd, onDragStart, open, previousColumn, task } = props;
  return (
    <article className="task-card" draggable={!!onDragStart} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <button className="task-card-open" onClick={open} aria-label={`Open ${task.publicKey} ${task.title}`}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0 }}>
            {!!onDragStart && <DragIndicatorOutlined aria-hidden="true" fontSize="small" color="disabled" />}
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
              {task.publicKey}
            </Typography>
          </Stack>
          <Tag value={task.priority} tone={priorityTone[task.priority]} />
        </Stack>
        <Typography className="task-card-title" sx={{ fontWeight: 700, mt: 1, textAlign: 'left' }}>
          {task.title}
        </Typography>
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
      {(moveBack || moveForward) && (
        <div className="task-card-move-actions" aria-label={`Move ${task.publicKey}`}>
          <IconButton
            disabled={!moveBack}
            onClick={moveBack}
            aria-label={`Move ${task.publicKey} to ${previousColumn}`}
          >
            <ArrowBackOutlined fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary">
            Move
          </Typography>
          <IconButton
            disabled={!moveForward}
            onClick={moveForward}
            aria-label={`Move ${task.publicKey} to ${nextColumn}`}
          >
            <ArrowForwardOutlined fontSize="small" />
          </IconButton>
        </div>
      )}
    </article>
  );
}

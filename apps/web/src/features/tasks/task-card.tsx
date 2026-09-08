import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { TaskContract } from '@tms/contracts';
import { Tag } from '../hr/ui';
import { priorityTone } from './task-types';

export function personName(person: TaskContract['assignee']) {
  return person ? `${person.firstName} ${person.lastName}` : 'Unassigned';
}

export function TaskCard({ task, open }: { task: TaskContract; open: () => void }) {
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

'use client';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import type { Board } from './task-types';

export function SprintHistory({ boards, select }: { boards: Board[]; select: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const completed = boards.filter(
    (board) =>
      board.kind === 'SCRUM' && board.status === 'INACTIVE' && board.name.toLowerCase().includes(search.toLowerCase()),
  );
  if (!boards.some((board) => board.kind === 'SCRUM' && board.status === 'INACTIVE')) return null;
  return (
    <>
      <Button startIcon={<HistoryOutlined />} onClick={() => setOpen(true)}>
        Past sprints
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Past sprints</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Search completed sprints"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
            <List aria-label="Past sprints" disablePadding>
              {completed.map((board) => (
                <ListItemButton
                  key={board.id}
                  onClick={() => {
                    select(board.id);
                    setOpen(false);
                  }}
                >
                  <ListItemText
                    primary={board.name}
                    secondary={
                      board.milestone ? new Date(board.milestone.dueDate).toLocaleDateString('en-GB') : undefined
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

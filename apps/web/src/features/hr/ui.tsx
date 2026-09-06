'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip, { type ChipProps } from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type ReactElement, type ReactNode } from 'react';
export interface Field {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
  value?: string | number;
  options?: { value: string; label: string }[];
}
export function Form({
  fields,
  onSubmit,
  label = 'Save',
}: {
  fields: Field[];
  onSubmit: (values: Record<string, string | number>) => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setSuccess(false);
        const data = new FormData(event.currentTarget);
        const values: Record<string, string | number> = {};
        for (const field of fields) {
          const value = String(data.get(field.name) ?? '');
          if (value !== '' || !field.optional) values[field.name] = field.type === 'number' ? Number(value) : value;
        }
        try {
          await onSubmit(values);
          setSuccess(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Unable to save');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Stack spacing={2}>
        {fields.map((f) => (
          <TextField
            key={f.name}
            name={f.name}
            label={f.label}
            type={f.type ?? 'text'}
            defaultValue={f.value ?? ''}
            required={!f.optional}
            select={!!f.options}
            fullWidth
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { 'aria-label': f.label },
              select: { inputProps: { 'aria-label': f.label } },
            }}
          >
            {f.options?.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        ))}
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">Saved successfully</Alert>}
        <Button type="submit" variant="contained" disabled={busy}>
          {busy ? 'Saving…' : label}
        </Button>
      </Stack>
    </form>
  );
}
export function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Paper className={className} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, height: '100%', borderRadius: 3 }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}
const tagColors: Record<string, ChipProps['color']> = {
  ACTIVE: 'success',
  APPROVED: 'success',
  PENDING: 'warning',
  SUSPENDED: 'warning',
  REJECTED: 'error',
  TERMINATED: 'error',
  INACTIVE: 'default',
  CANCELLED: 'default',
  DRAFT: 'info',
};
export function StatusTag({ value }: { value: string }) {
  return (
    <Chip
      className="status-tag"
      color={tagColors[value] ?? 'default'}
      label={value.replaceAll('_', ' ').toLowerCase()}
      size="small"
      variant={['ACTIVE', 'APPROVED'].includes(value) ? 'filled' : 'outlined'}
    />
  );
}
export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {detail}
      </Typography>
    </div>
  );
}
export function ModalForm({
  buttonLabel,
  title,
  description,
  fields,
  onSubmit,
  submitLabel = 'Save changes',
  variant = 'outlined',
  icon,
}: {
  buttonLabel: string;
  title: string;
  description?: string;
  fields: Field[];
  onSubmit: (values: Record<string, string | number>) => Promise<void>;
  submitLabel?: string;
  variant?: 'text' | 'outlined' | 'contained';
  icon?: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} startIcon={icon} onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          {description && (
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {description}
            </Typography>
          )}
          <Form
            fields={fields}
            label={submitLabel}
            onSubmit={async (values) => {
              await onSubmit(values);
              setOpen(false);
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load';
}

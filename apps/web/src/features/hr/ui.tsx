'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useState, type ReactElement, type ReactNode } from 'react';
export interface Field {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
  value?: string | number;
  options?: { value: string; label: string }[];
}
export interface FormResult {
  close?: boolean;
  notice?: string;
}
export interface SubmitAction {
  label: string;
  value: string;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'error';
}
export function Form({
  fields,
  onSubmit,
  label = 'Save',
  actions,
}: {
  fields: Field[];
  onSubmit: (values: Record<string, string | number>) => Promise<void | FormResult>;
  label?: string;
  actions?: SubmitAction[];
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setSuccess('');
        const data = new FormData(event.currentTarget);
        const values: Record<string, string | number> = {};
        for (const field of fields) {
          const value = String(data.get(field.name) ?? '');
          if (value !== '' || !field.optional) values[field.name] = field.type === 'number' ? Number(value) : value;
        }
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) values[submitter.name] = submitter.value;
        try {
          const result = await onSubmit(values);
          const notice = result?.notice ?? 'Changes saved successfully';
          if (result?.close === false) setSuccess(notice);
          else window.dispatchEvent(new CustomEvent('hris:notice', { detail: notice }));
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
            key={`${f.name}:${f.value ?? ''}`}
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
        {success && <Alert severity="success">{success}</Alert>}
        {actions ? (
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} sx={{ justifyContent: 'flex-end' }}>
            {actions.map((action) => (
              <Button
                key={action.value}
                type="submit"
                name="action"
                value={action.value}
                variant={action.variant ?? 'outlined'}
                color={action.color ?? 'primary'}
                disabled={busy}
              >
                {busy ? 'Working…' : action.label}
              </Button>
            ))}
          </Stack>
        ) : (
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Saving…' : label}
          </Button>
        )}
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
const tagLabels: Record<string, string> = {
  ACCOUNT_DIRECTOR: 'Director',
  SENIOR_DIRECTOR: 'Senior',
  CHRISTMAS_VACATION: 'Christmas',
  FULL_TIME: 'Permanent',
  PROBATIONARY: 'Probation',
  EMPLOYEE_CREATE: 'Onboard',
  EMPLOYEE_READ: 'Directory',
  EMPLOYEE_UPDATE: 'Profiles',
  EMPLOYEE_STATUS_MANAGE: 'Status',
  EMPLOYEE_PASSWORD_RESET: 'Passwords',
  EMPLOYEE_PRIVATE_READ: 'Private',
  DEPARTMENT_CREATE: 'Departments',
  DEPARTMENT_UPDATE: 'Structure',
  DEPARTMENT_ASSIGN_MEMBER: 'Transfers',
  DEPARTMENT_ASSIGN_ACCOUNT_DIRECTOR: 'Directors',
  ORGANIZATION_MANAGE: 'Governance',
  EMPLOYMENT_MANAGE: 'Employment',
  LEAVE_POLICY_MANAGE: 'Policies',
  CHRISTMAS_POLICY_MANAGE: 'Christmas',
  LEAVE_ADMIN: 'Leave',
  LEAVE_HR_APPROVE: 'Approvals',
  PERMISSION_ASSIGN: 'Grant',
  PERMISSION_REVOKE: 'Revoke',
  AUDIT_READ: 'Audit',
  REPORTING_READ: 'Reports',
  LEAVE_CORRECTED: 'Corrected',
  SIGNED_OFF: 'Signed',
  IN_PROGRESS: 'Progress',
  'In progress': 'Progress',
  'To do': 'Todo',
};
const tagTones: Record<string, keyof typeof tagPalette> = {
  ACTIVE: 'green',
  APPROVED: 'green',
  PENDING: 'amber',
  SUSPENDED: 'amber',
  REJECTED: 'red',
  TERMINATED: 'red',
  INACTIVE: 'grey',
  CANCELLED: 'grey',
  DRAFT: 'blue',
  VACATION: 'blue',
  SICK: 'red',
  CHRISTMAS_VACATION: 'teal',
  SENIOR_DIRECTOR: 'purple',
  ACCOUNT_DIRECTOR: 'purple',
  MEMBER: 'grey',
};
const tagPalette = {
  green: { background: 'var(--color-success-soft)', color: 'var(--color-evergreen-deep)' },
  amber: { background: 'var(--color-warning-soft)', color: 'var(--color-ink)' },
  red: { background: 'var(--color-danger-soft)', color: 'var(--color-ink)' },
  blue: { background: 'var(--color-canvas)', color: 'var(--color-evergreen-deep)' },
  purple: { background: 'var(--color-leaf)', color: 'var(--color-forest)' },
  teal: { background: 'var(--color-success-soft)', color: 'var(--color-evergreen-deep)' },
  grey: { background: 'var(--color-canvas)', color: 'var(--color-muted)' },
};
export function Tag({ value, tone }: { value: string; tone?: keyof typeof tagPalette }) {
  const palette = tagPalette[tone ?? tagTones[value] ?? 'grey'];
  const expanded =
    tagLabels[value] ??
    value
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^./, (letter) => letter.toUpperCase());
  const count = expanded.match(/^(\d+)\s+(.+)$/);
  const label = count
    ? `${count[2].split(/\s+/)[0]}:${count[1]}`
    : expanded.includes(' ')
      ? expanded
          .split(/\s+/)
          .map((word) => word[0])
          .join('')
          .toUpperCase()
      : expanded;
  return (
    <Chip
      className="status-tag"
      label={label}
      title={value.replaceAll('_', ' ')}
      size="small"
      sx={{ bgcolor: palette.background, color: palette.color, maxWidth: 112 }}
    />
  );
}
export function StatusTag({ value }: { value: string }) {
  return <Tag value={value} />;
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
export function LoadingState({ label = 'Loading content' }: { label?: string }) {
  return (
    <Stack role="status" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
      <CircularProgress size={30} aria-hidden="true" />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
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
  actions,
}: {
  buttonLabel: string;
  title: string;
  description?: string;
  fields: Field[];
  onSubmit: (values: Record<string, string | number>) => Promise<void | FormResult>;
  submitLabel?: string;
  variant?: 'text' | 'outlined' | 'contained';
  icon?: ReactElement;
  actions?: SubmitAction[];
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
            actions={actions}
            onSubmit={async (values) => {
              const result = await onSubmit(values);
              if (result?.close !== false) setOpen(false);
              return result;
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

'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState, type ReactNode } from 'react';
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
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, height: '100%', borderRadius: 3 }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to load';
}

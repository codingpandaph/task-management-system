'use client';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormLabel from '@mui/material/FormLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { useState } from 'react';
import type { Field, FormResult, SubmitAction } from './ui-types';

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
    [success, setSuccess] = useState(''),
    [values, setValues] = useState<Record<string, string | number>>(() =>
      Object.fromEntries(fields.map((field) => [field.name, field.value ?? ''])),
    );
  const visibleFields = fields.filter(
    (field) =>
      !field.showWhen ||
      String(values[field.showWhen.field] ?? '')
        .split(',')
        .some((value) => field.showWhen!.values.includes(value)),
  );
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (visibleFields.some((field) => field.checkboxes && !field.optional && !values[field.name])) {
          setError('Select at least one task management type.');
          return;
        }
        setBusy(true);
        setError('');
        setSuccess('');
        const data = new FormData(event.currentTarget);
        const submittedValues: Record<string, string | number> = {};
        for (const field of visibleFields) {
          const value = field.multiple
            ? data.getAll(field.name).map(String).join(',')
            : String(data.get(field.name) ?? '');
          if (value !== '' || !field.optional)
            submittedValues[field.name] = field.type === 'number' ? Number(value) : value;
        }
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) submittedValues[submitter.name] = submitter.value;
        try {
          const result = await onSubmit(submittedValues);
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
        {visibleFields.map((f) =>
          f.checkboxes ? (
            <FormControl key={f.name} component="fieldset">
              <FormLabel component="legend">{f.label}</FormLabel>
              <FormControlLabel
                label="Select all"
                control={
                  <Checkbox
                    checked={
                      !!f.options?.length &&
                      f.options.every((option) => String(values[f.name]).split(',').includes(option.value))
                    }
                    indeterminate={
                      !!values[f.name] &&
                      !f.options?.every((option) => String(values[f.name]).split(',').includes(option.value))
                    }
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [f.name]: event.target.checked ? f.options!.map((option) => option.value).join(',') : '',
                      }))
                    }
                  />
                }
              />
              <FormGroup row>
                {f.options?.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    label={option.label}
                    control={
                      <Checkbox
                        name={f.name}
                        value={option.value}
                        checked={String(values[f.name]).split(',').includes(option.value)}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [f.name]: (event.target.checked
                              ? [...String(current[f.name]).split(',').filter(Boolean), option.value]
                              : String(current[f.name])
                                  .split(',')
                                  .filter((value) => value !== option.value)
                            ).join(','),
                          }))
                        }
                      />
                    }
                  />
                ))}
              </FormGroup>
            </FormControl>
          ) : (
            <TextField
              key={`${f.name}:${f.value ?? ''}`}
              name={f.name}
              label={f.label}
              type={f.type ?? 'text'}
              defaultValue={
                f.multiple
                  ? String(f.value ?? '')
                      .split(',')
                      .filter(Boolean)
                  : (f.value ?? '')
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [f.name]: Array.isArray(event.target.value) ? event.target.value.join(',') : event.target.value,
                }))
              }
              required={!f.optional}
              select={!!f.options}
              fullWidth
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { 'aria-label': f.label },
                select: { multiple: f.multiple, inputProps: { 'aria-label': f.label } },
              }}
            >
              {f.options?.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          ),
        )}
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

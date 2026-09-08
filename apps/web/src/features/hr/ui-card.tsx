import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export function Card({
  title,
  children,
  className,
  actions,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <Paper className={className} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, height: '100%', borderRadius: 3 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { md: 'center' }, justifyContent: 'space-between' }}
      >
        <Typography component="h2" variant="h6">
          {title}
        </Typography>
        {actions && <div className="surface-actions">{actions}</div>}
      </Stack>
      {children}
    </Paper>
  );
}

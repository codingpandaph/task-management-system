'use client';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { api } from '@/lib/api';
import { Form } from './ui';

type Props = { loggedIn: () => Promise<void> };

export function LoginScreen({ loggedIn }: Props) {
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand-mark">CP</div>
        <Typography component="h1" variant="h2" sx={{ mt: 4, maxWidth: 560 }}>
          A clearer view of your people.
        </Typography>
        <Typography sx={{ mt: 3, maxWidth: 400, opacity: 0.8 }}>
          One place for your organization, time away, and the work of looking after your team.
        </Typography>
        <div className="auth-footer">PEOPLE · ORGANIZATION · TIME AWAY</div>
      </section>
      <section className="auth-form">
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, width: '100%', maxWidth: 430 }}>
          <Chip label="Portal" size="small" sx={{ mb: 3 }} />
          <Typography variant="h4" component="h2">
            Welcome back
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 4 }}>
            Sign in with your Employee ID.
          </Typography>
          <Form
            fields={[
              { name: 'employeeId', label: 'Employee ID' },
              { name: 'password', label: 'Password', type: 'password' },
            ]}
            label="Sign in"
            onSubmit={async (values) => {
              await api('auth/login', values);
              await loggedIn();
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Need access or a password reset? Contact your HR administrator.
          </Typography>
        </Paper>
      </section>
    </main>
  );
}

export function ChangePasswordScreen({ loggedIn }: Props) {
  return (
    <Box component="main" sx={{ maxWidth: 480, mx: 'auto', p: 3, pt: 8 }}>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Choose your password
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        Change your temporary password before accessing the portal. Use at least 15 characters and avoid a password you
        use elsewhere.
      </Alert>
      <Form
        fields={[
          { name: 'currentPassword', label: 'Temporary password', type: 'password' },
          { name: 'password', label: 'New password', type: 'password' },
          { name: 'confirmPassword', label: 'Confirm new password', type: 'password' },
        ]}
        label="Change password"
        onSubmit={async ({ confirmPassword, ...values }) => {
          if (values.password !== confirmPassword) throw new Error('The new passwords do not match. Try again.');
          await api('auth/change-password', values);
          await loggedIn();
        }}
      />
    </Box>
  );
}

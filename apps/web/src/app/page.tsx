import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 sm:p-8">
      <Paper component="section" elevation={1} className="w-full max-w-2xl p-6 sm:p-10">
        <Typography component="h1" variant="h4" className="mb-4 text-3xl sm:text-4xl">
          Task Management System
        </Typography>
        <Typography>The frontend is running.</Typography>
      </Paper>
    </main>
  );
}

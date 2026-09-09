# Backup and recovery proof

The scripts deliberately accept only a named local database and reject names containing `prod` or `production`.

```bash
DATABASE_URL=postgresql://localhost:5432/tms_development yarn db:backup
DATABASE_URL=postgresql://localhost:5432/tms_development yarn db:restore:verify backups/<file>.dump
```

The backup uses PostgreSQL custom format. Verification recreates the disposable `tms_restore_verify` database,
restores the backup, and queries the employee table as a basic integrity proof. It never restores over the source.
Record the command output and elapsed time during a rehearsal. The script drops the disposable database after a
successful integrity check.

For the job prototype, the rehearsal targets are RPO 24 hours and RTO 4 hours. Production values require business
approval, encrypted storage, retention rules, access control, scheduled backups, and recurring restore drills.

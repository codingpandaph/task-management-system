import { spawnSync } from 'node:child_process';
import { approvedPrototypeDatabase } from './database-safety.mjs';

const [backup] = process.argv.slice(2);
const source = process.env.DATABASE_URL;
if (!backup || !source) throw new Error('Usage: DATABASE_URL=... yarn db:restore:verify <backup.dump>');
const url = new URL(source);
const verifyName = 'tms_restore_verify';
if (!approvedPrototypeDatabase(source, url.pathname.slice(1)))
  throw new Error('Restore verification requires an approved local source database');
const admin = new URL(source);
admin.pathname = '/postgres';
const run = (command, args) => spawnSync(command, args, { stdio: 'inherit' });
run('dropdb', ['--if-exists', '--force', '--maintenance-db', admin.toString(), verifyName]);
if (run('createdb', ['--maintenance-db', admin.toString(), verifyName]).status !== 0)
  throw new Error('createdb failed');
const verifyUrl = new URL(source);
verifyUrl.pathname = `/${verifyName}`;
if (run('pg_restore', ['--no-owner', '--dbname', verifyUrl.toString(), backup]).status !== 0)
  throw new Error('pg_restore failed');
if (run('psql', [verifyUrl.toString(), '--tuples-only', '--command', 'SELECT COUNT(*) FROM "Employee";']).status !== 0)
  throw new Error('Integrity query failed');
if (run('dropdb', ['--force', '--maintenance-db', admin.toString(), verifyName]).status !== 0)
  throw new Error('Verification cleanup failed');
console.log(`Restore verified and disposable database ${verifyName} removed.`);

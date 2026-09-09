import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { approvedPrototypeDatabase } from './database-safety.mjs';

const source = process.env.DATABASE_URL;
if (!source) throw new Error('DATABASE_URL is required');
const name = new URL(source).pathname.slice(1);
if (!approvedPrototypeDatabase(source, name)) throw new Error('Backups are restricted to an approved local database');
mkdirSync('backups', { recursive: true });
const target = resolve('backups', `${name}-${new Date().toISOString().replaceAll(':', '-')}.dump`);
const result = spawnSync('pg_dump', ['--format=custom', '--no-owner', '--file', target, source], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('pg_dump failed');
console.log(`Backup created: ${target}`);

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .trim()
  .split('\n');
const suspicious = /(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|sk-[A-Za-z0-9]{20,}|gh[opusr]_[A-Za-z0-9]{30,})/;
const findings = files.filter((file) => {
  if (!file || /\.(png|jpg|jpeg|gif|dump)$/.test(file)) return false;
  try {
    return suspicious.test(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
});
if (findings.length) throw new Error(`Possible secrets found in: ${findings.join(', ')}`);
console.log(`Secret scan passed across ${files.length} tracked files.`);

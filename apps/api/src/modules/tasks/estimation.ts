export function formatEstimation(hours: number) {
  if (!Number.isFinite(hours) || hours < 0) throw new Error('Hours must be a nonnegative number');
  const days = Math.floor(hours / 8);
  const remainder = Number((hours % 8).toFixed(2));
  return [days ? `${days}d` : '', remainder ? `${remainder}h` : '', !days && !remainder ? '0h' : '']
    .filter(Boolean)
    .join(' ');
}

export function parseEstimationInput(input: string) {
  const normalized = input.trim().toLowerCase();
  const match = normalized.match(/^(?:(\d+(?:\.\d+)?)d)?\s*(?:(\d+(?:\.\d+)?)h)?$/);
  if (!match || (!match[1] && !match[2])) throw new Error('Use days and hours, for example 1d 4h');
  const hours = Number(match[1] ?? 0) * 8 + Number(match[2] ?? 0);
  if (!Number.isFinite(hours) || hours < 0) throw new Error('Estimation must be nonnegative');
  return hours;
}

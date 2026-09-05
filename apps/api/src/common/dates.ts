import { UnprocessableEntityException } from '@nestjs/common';

export function today(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function dateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new UnprocessableEntityException('Invalid calendar date');
  }
  return date;
}
export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

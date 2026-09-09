import type { Position } from './generated/prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type SeedPerson = [string, string, string | null, Position];

const corePeople: SeedPerson[] = [
  ['Avery', 'Morgan', null, 'SENIOR_DIRECTOR'],
  ['Jordan', 'Ellis', 'ACC', 'ACCOUNT_DIRECTOR'],
  ['Casey', 'Rowan', 'MKT', 'ACCOUNT_DIRECTOR'],
  ['Taylor', 'Quinn', 'HR', 'ACCOUNT_DIRECTOR'],
  ['Morgan', 'Reed', 'HR', 'MEMBER'],
  ['Riley', 'Shaw', 'HR', 'MEMBER'],
  ['Alex', 'Finch', 'ACC', 'MEMBER'],
  ['Sam', 'River', 'MKT', 'MEMBER'],
  ['Jamie', 'Brook', 'ACC', 'MEMBER'],
  ['Robin', 'Vale', 'MKT', 'MEMBER'],
  ['Drew', 'Lane', 'ACC', 'MEMBER'],
];

const clientMembers = [
  ['Cameron', 'Blake'],
  ['Emery', 'Stone'],
  ['Frankie', 'Hart'],
  ['Harper', 'Cole'],
  ['Jules', 'Wells'],
  ['Kai', 'Reeves'],
  ['Logan', 'Price'],
  ['Micah', 'Ford'],
  ['Noel', 'Hayes'],
  ['Parker', 'Dean'],
  ['Quinn', 'Frost'],
  ['Rowan', 'Bell'],
] as const;

const marketingMembers = [
  ['Ari', 'West'],
  ['Billie', 'Cross'],
  ['Charlie', 'North'],
  ['Devon', 'Lake'],
  ['Elliot', 'Green'],
  ['Finley', 'Moore'],
  ['Gray', 'Young'],
  ['Hayden', 'Scott'],
  ['Indigo', 'King'],
  ['Justice', 'Wood'],
  ['Kit', 'Ward'],
  ['Lennon', 'Fox'],
  ['Marley', 'Rose'],
] as const;

export function seedPeople(limited: boolean): SeedPerson[] {
  if (limited) return corePeople.slice(0, 7);
  return [
    ...corePeople,
    ...clientMembers.map(([first, last]) => [first, last, 'ACC', 'MEMBER'] as SeedPerson),
    ...marketingMembers.map(([first, last]) => [first, last, 'MKT', 'MEMBER'] as SeedPerson),
  ];
}

export function seedBoardColumns(code: string) {
  const active =
    code === 'HR'
      ? [{ name: 'Open', semantic: 'OPEN' as const, position: 0, isInitial: true }]
      : [
          { name: 'To do', semantic: 'TODO' as const, position: 0, isInitial: true },
          { name: 'In progress', semantic: 'IN_PROGRESS' as const, position: 1 },
          { name: 'Review', semantic: 'REVIEW' as const, position: 2 },
        ];
  return [
    ...active,
    {
      name: 'Done',
      semantic: 'DONE' as const,
      position: code === 'HR' ? 1 : 3,
      isDone: true,
      managementLocked: code !== 'HR',
    },
  ];
}

export async function seedHolidayEvents() {
  const data = JSON.parse(
    await readFile(resolve(process.cwd(), '../../prisma/fixtures/uk-bank-holidays.json'), 'utf8'),
  ) as Record<string, { events: { date: string; title: string }[] }>;
  return data['england-and-wales'].events;
}

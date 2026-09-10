import type { Position } from './generated/prisma/client';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface SeedTeam {
  departmentCode: 'ACC' | 'MKT' | 'HR';
  code: string;
  name: string;
}

export interface SeedPerson {
  firstName: string;
  lastName: string;
  departmentCode: 'ACC' | 'MKT' | 'HR' | null;
  teamCode: string | null;
  position: Position;
}

export const seedTeams: SeedTeam[] = [
  { departmentCode: 'ACC', code: 'CLIENT-A', name: 'Client Success' },
  { departmentCode: 'ACC', code: 'CLIENT-B', name: 'Account Growth' },
  { departmentCode: 'MKT', code: 'MKT-A', name: 'Brand & Content' },
  { departmentCode: 'MKT', code: 'MKT-B', name: 'Growth Marketing' },
  { departmentCode: 'HR', code: 'HR-A', name: 'People Operations' },
];

const person = (
  firstName: string,
  lastName: string,
  departmentCode: SeedPerson['departmentCode'],
  teamCode: string | null,
  position: Position,
): SeedPerson => ({ firstName, lastName, departmentCode, teamCode, position });

// Keep the first eleven records stable: browser fixtures use their deterministic employee IDs.
const corePeople: SeedPerson[] = [
  person('Avery', 'Morgan', null, null, 'MANAGING_DIRECTOR'),
  person('Jordan', 'Ellis', 'ACC', 'CLIENT-A', 'ACCOUNT_DIRECTOR'),
  person('Casey', 'Rowan', 'MKT', 'MKT-A', 'ACCOUNT_DIRECTOR'),
  person('Taylor', 'Quinn', 'HR', 'HR-A', 'ACCOUNT_DIRECTOR'),
  person('Morgan', 'Reed', 'HR', 'HR-A', 'MEMBER'),
  person('Riley', 'Shaw', 'HR', 'HR-A', 'MEMBER'),
  person('Alex', 'Finch', 'ACC', 'CLIENT-A', 'MEMBER'),
  person('Sam', 'River', 'MKT', 'MKT-A', 'MEMBER'),
  person('Jamie', 'Brook', 'ACC', 'CLIENT-A', 'MEMBER'),
  person('Robin', 'Vale', 'MKT', 'MKT-A', 'MEMBER'),
  person('Drew', 'Lane', 'ACC', 'CLIENT-A', 'MEMBER'),
  person('Sidney', 'Clarke', 'ACC', null, 'SENIOR_DIRECTOR'),
  person('Reese', 'Palmer', 'MKT', null, 'SENIOR_DIRECTOR'),
  person('Hayden', 'Brooks', 'HR', null, 'SENIOR_DIRECTOR'),
  person('Bailey', 'Grant', 'ACC', 'CLIENT-B', 'ACCOUNT_DIRECTOR'),
  person('Dakota', 'Flynn', 'MKT', 'MKT-B', 'ACCOUNT_DIRECTOR'),
];

const deliveryMembers: Record<string, readonly (readonly [string, string])[]> = {
  'CLIENT-A': [
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
    ['Skyler', 'Grant'],
  ],
  'CLIENT-B': [
    ['Adrian', 'Bishop'],
    ['Blair', 'Carson'],
    ['Cleo', 'Dawson'],
    ['Dylan', 'Evans'],
    ['Ellis', 'Fisher'],
    ['Fallon', 'Gibbs'],
    ['Gale', 'Hughes'],
    ['Hollis', 'Irwin'],
    ['Jody', 'James'],
    ['Kendall', 'Knight'],
    ['Lane', 'Lewis'],
    ['Milan', 'Miles'],
    ['Nico', 'Nash'],
    ['Oakley', 'Owens'],
    ['Payton', 'Pierce'],
  ],
  'MKT-A': [
    ['Ari', 'West'],
    ['Billie', 'Cross'],
    ['Charlie', 'North'],
    ['Devon', 'Lake'],
    ['Elliot', 'Green'],
    ['Finley', 'Moore'],
    ['Gray', 'Young'],
    ['Indigo', 'King'],
    ['Justice', 'Wood'],
    ['Kit', 'Ward'],
    ['Lennon', 'Fox'],
    ['Marley', 'Rose'],
    ['Phoenix', 'Snow'],
    ['River', 'Scott'],
  ],
  'MKT-B': [
    ['Remy', 'Adams'],
    ['Sage', 'Baker'],
    ['Tatum', 'Carter'],
    ['Val', 'Diaz'],
    ['Winter', 'Edwards'],
    ['Yael', 'Flores'],
    ['Zion', 'Garcia'],
    ['Ainsley', 'Hill'],
    ['Briar', 'Ingram'],
    ['Cory', 'Jones'],
    ['Darcy', 'Kelly'],
    ['Eden', 'Long'],
    ['Flynn', 'Martin'],
    ['Greer', 'Nelson'],
    ['Hero', 'Ortiz'],
  ],
};

export function seedPeople(limited: boolean): SeedPerson[] {
  if (limited) return corePeople;
  const generated = Object.entries(deliveryMembers).flatMap(([teamCode, names]) => {
    const departmentCode = teamCode.startsWith('CLIENT') ? 'ACC' : 'MKT';
    return names.map(([first, last]) => person(first, last, departmentCode, teamCode, 'MEMBER'));
  });
  return [...corePeople, ...generated];
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

import TableCell from '@mui/material/TableCell';
import TableSortLabel from '@mui/material/TableSortLabel';
import { useState } from 'react';

export function useTableSort(initial: string, initialDirection: 'asc' | 'desc' = 'asc') {
  const [key, setKey] = useState(initial);
  const [direction, setDirection] = useState<'asc' | 'desc'>(initialDirection);
  function toggle(column: string) {
    setDirection(key === column && direction === 'asc' ? 'desc' : 'asc');
    setKey(column);
  }
  function sorted<T>(items: T[], value: (item: T, key: string) => string | number | null | undefined) {
    return [...items].sort((a, b) => {
      const left = value(a, key),
        right = value(b, key);
      if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
      if (right === null || right === undefined) return -1;
      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? comparison : -comparison;
    });
  }
  return { key, direction, toggle, sorted };
}

export function SortHeader({
  label,
  column,
  sort,
}: {
  label: string;
  column: string;
  sort: { key: string; direction: 'asc' | 'desc'; toggle: (key: string) => void };
}) {
  return (
    <TableCell sortDirection={sort.key === column ? sort.direction : false}>
      <TableSortLabel
        active={sort.key === column}
        direction={sort.key === column ? sort.direction : 'asc'}
        onClick={() => sort.toggle(column)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

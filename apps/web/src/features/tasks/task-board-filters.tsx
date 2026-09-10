import FilterAltOffOutlined from '@mui/icons-material/FilterAltOffOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { DirectoryEmployee } from '@tms/contracts';

type Props = {
  boardName: string;
  teamId: string;
  people: DirectoryEmployee[];
  search: string;
  priority: string;
  assignee: string;
  setSearch: (value: string) => void;
  setPriority: (value: string) => void;
  setAssignee: (value: string) => void;
};
export function TaskBoardFilters(props: Props) {
  const { boardName, teamId, people, search, priority, assignee, setSearch, setPriority, setAssignee } = props;
  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} useFlexGap className="task-board-filters">
      <TextField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        label={`Search ${boardName}`}
        size="small"
        sx={{ minWidth: { md: 300 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined />
              </InputAdornment>
            ),
          },
        }}
      />
      <TextField select size="small" label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
        <MenuItem value="ALL">All priorities</MenuItem>
        <MenuItem value="HIGH">High</MenuItem>
        <MenuItem value="MEDIUM">Medium</MenuItem>
        <MenuItem value="LOW">Low</MenuItem>
      </TextField>
      <TextField select size="small" label="Assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
        <MenuItem value="ALL">All assignees</MenuItem>
        <MenuItem value="UNASSIGNED">Unassigned</MenuItem>
        {people
          .filter((person) => person.team?.id === teamId)
          .map((person) => (
            <MenuItem key={person.id} value={person.id}>
              {person.displayName}
            </MenuItem>
          ))}
      </TextField>
      {(search || priority !== 'ALL' || assignee !== 'ALL') && (
        <Button
          startIcon={<FilterAltOffOutlined />}
          onClick={() => {
            setSearch('');
            setPriority('ALL');
            setAssignee('ALL');
          }}
        >
          Clear filters
        </Button>
      )}
    </Stack>
  );
}

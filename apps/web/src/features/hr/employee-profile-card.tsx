import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { resolveAccessRole } from '@tms/contracts';
import { Card, EmptyState, StatusTag, Tag } from './ui';
import type { EmployeeDetail, EmploymentRecord, PermissionGrant } from './organization-types';

export function EmployeeProfileCard({
  detail,
  employeeTab,
  employment,
  permissionGrants,
  setEmployeeTab,
}: {
  detail: EmployeeDetail;
  employeeTab: number;
  employment: EmploymentRecord[];
  permissionGrants: PermissionGrant[];
  setEmployeeTab: (value: number) => void;
}) {
  return (
    <Card title="Employee profile" className="profile-card">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} sx={{ alignItems: { sm: 'center' } }}>
        <Avatar sx={{ width: 68, height: 68, bgcolor: 'primary.dark', fontSize: 'var(--text-title)' }}>
          {detail.displayName
            .split(' ')
            .map((part) => part[0])
            .slice(0, 2)
            .join('')}
        </Avatar>
        <div>
          <Typography variant="h4" component="h2">
            {detail.displayName}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
            <StatusTag value={detail.status} />
            <Tag value={detail.position} />
            <Tag value={detail.department?.name ?? 'Organization-wide'} tone="teal" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {detail.employeeId}
          </Typography>
        </div>
      </Stack>
      <Tabs
        value={employeeTab}
        onChange={(_, value: number) => setEmployeeTab(value)}
        aria-label="Employee profile sections"
        variant="scrollable"
        sx={{ mt: 3 }}
      >
        <Tab label="Overview" />
        <Tab label="Employment" />
        <Tab label="Leave policies" />
        <Tab label="Access & security" />
      </Tabs>
      {employeeTab === 0 && (
        <div className="profile-facts">
          <div>
            <span>Department</span>
            <strong>{detail.department?.name ?? 'Organization-wide'}</strong>
          </div>
          <div>
            <span>Position</span>
            <strong>{detail.position.replaceAll('_', ' ')}</strong>
          </div>
          {detail.email && (
            <div>
              <span>Email</span>
              <strong>{detail.email}</strong>
            </div>
          )}
          {detail.birthDate && (
            <div>
              <span>Birth date</span>
              <strong>{detail.birthDate}</strong>
            </div>
          )}
        </div>
      )}
      {employeeTab === 1 && (
        <Stack spacing={2} sx={{ mt: 3 }}>
          <Typography color="text.secondary">
            Effective-dated employment history, with the current record first.
          </Typography>
          {employment.length ? (
            <div className="table-scroll">
              <Table size="small" aria-label="Employment history">
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>Employment dates</TableCell>
                    <TableCell>Effective period</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employment.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Tag value={record.type} tone="blue" />
                      </TableCell>
                      <TableCell>
                        {record.startDate.slice(0, 10)} – {record.endDate?.slice(0, 10) ?? 'Open-ended'}
                        {record.probationEnd && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Review {record.probationEnd.slice(0, 10)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.effectiveFrom.slice(0, 10)} – {record.effectiveTo?.slice(0, 10) ?? 'Current'}
                      </TableCell>
                      <TableCell>{record.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No employment history" detail="Add the employee’s first employment record." />
          )}
        </Stack>
      )}
      {employeeTab === 2 && (
        <Typography color="text.secondary" sx={{ mt: 3 }}>
          Assign next-year regular and Christmas leave policies.
        </Typography>
      )}
      {employeeTab === 3 && (
        <Stack spacing={2} sx={{ mt: 3 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography color="text.secondary">Effective role</Typography>
            <Tag value={resolveAccessRole(detail.position, detail.department?.kind === 'HR')} tone="purple" />
          </Stack>
          <Typography color="text.secondary">Additional access grants within this role’s ceiling.</Typography>
          {permissionGrants.length ? (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {permissionGrants.map((grant) => (
                <Tag key={grant.id} value={grant.permission.code} tone="purple" />
              ))}
            </Stack>
          ) : (
            <EmptyState title="No explicit permissions" detail="This employee only has standard account access." />
          )}
        </Stack>
      )}
    </Card>
  );
}

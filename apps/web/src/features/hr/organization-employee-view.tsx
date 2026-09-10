import EditOutlined from '@mui/icons-material/EditOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import { canRoleHoldPermission, PERMISSIONS, type CurrentEmployee } from '@tms/contracts';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import { ModalForm, type Field } from './ui';
import { EmployeeProfileCard } from './employee-profile-card';
import type { EmployeeDetail, EmploymentRecord, PermissionGrant } from './organization-types';
import { permissionName, plainName } from './plain-language';

export function OrganizationEmployeeView({
  can,
  christmasOptions,
  credentialDialog,
  detail,
  employeeTab,
  employment,
  error,
  id,
  options,
  permissionGrants,
  policyOptions,
  save,
  setEmployeeTab,
  setSecret,
  user,
  teamOptions,
}: {
  can: (permission: CurrentEmployee['permissions'][number]) => boolean;
  christmasOptions: { value: string; label: string }[];
  credentialDialog: ReactNode;
  detail: EmployeeDetail | null;
  employeeTab: number;
  employment: EmploymentRecord[];
  error: string;
  id: string;
  options: { value: string; label: string }[];
  permissionGrants: PermissionGrant[];
  policyOptions: { value: string; label: string }[];
  save: (endpoint: string, values: Record<string, unknown>, method?: string) => Promise<void>;
  setEmployeeTab: (value: number) => void;
  setSecret: (value: string) => void;
  user: CurrentEmployee;
  teamOptions: { value: string; label: string }[];
}) {
  const reason: Field = { name: 'reason', label: 'Reason' };
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {detail && (
        <>
          <EmployeeProfileCard
            detail={detail}
            employeeTab={employeeTab}
            employment={employment}
            permissionGrants={permissionGrants}
            setEmployeeTab={setEmployeeTab}
            actions={
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {employeeTab === 0 && can('EMPLOYEE_UPDATE') && (
                  <ModalForm
                    buttonLabel="Edit profile"
                    icon={<EditOutlined />}
                    title="Edit basic information"
                    fields={[
                      { name: 'firstName', label: 'First name', value: detail.firstName },
                      { name: 'middleName', label: 'Middle name', optional: true, value: detail.middleName },
                      { name: 'lastName', label: 'Last name', value: detail.lastName },
                      { name: 'email', label: 'Email', type: 'email', optional: true, value: detail.email },
                    ]}
                    onSubmit={(v) => save(`employees/${id}`, { ...v, version: detail.version }, 'PATCH')}
                  />
                )}
                {employeeTab === 0 && can('DEPARTMENT_ASSIGN_MEMBER') && (
                  <ModalForm
                    buttonLabel="Transfer team"
                    icon={<ManageAccountsOutlined />}
                    title="Transfer department and team"
                    fields={[
                      { name: 'departmentId', label: 'Department', options },
                      { name: 'teamId', label: 'Team', options: teamOptions },
                      reason,
                    ]}
                    onSubmit={(v) => save(`employees/${id}/transfer`, v)}
                  />
                )}
                {employeeTab === 3 && can('EMPLOYEE_STATUS_MANAGE') && (
                  <ModalForm
                    buttonLabel="Suspend access"
                    title="Suspend employee access"
                    submitLabel="Suspend employee"
                    fields={[reason, { name: 'suspendedUntil', label: 'Suspended until', type: 'datetime-local' }]}
                    onSubmit={(v) =>
                      save(`employees/${id}/suspend`, {
                        ...v,
                        suspendedUntil: new Date(String(v.suspendedUntil)).toISOString(),
                      })
                    }
                  />
                )}
                {employeeTab === 3 && can('EMPLOYEE_STATUS_MANAGE') && (
                  <ModalForm
                    buttonLabel="Change status"
                    title="Change account status"
                    fields={[
                      {
                        name: 'action',
                        label: 'Action',
                        options: [
                          { value: 'deactivate', label: 'Deactivate' },
                          { value: 'reactivate', label: 'Reactivate' },
                          { value: 'terminate', label: 'Terminate' },
                        ],
                      },
                      reason,
                    ]}
                    onSubmit={async ({ action, ...v }) => save(`employees/${id}/${action}`, v)}
                  />
                )}
                {employeeTab === 3 && can('EMPLOYEE_PASSWORD_RESET') && (
                  <ModalForm
                    buttonLabel="Reset password"
                    title="Reset employee password"
                    submitLabel="Generate temporary password"
                    fields={[reason]}
                    onSubmit={async (v) => {
                      const r = await api<{ temporaryPassword: string }>(`employees/${id}/reset-password`, v);
                      setSecret(r.temporaryPassword);
                    }}
                  />
                )}
                {employeeTab === 1 && can('EMPLOYMENT_MANAGE') && (
                  <ModalForm
                    buttonLabel="Add employment record"
                    title="Add employment record"
                    fields={[
                      {
                        name: 'type',
                        label: 'Employment type',
                        options: ['FULL_TIME', 'CONTRACTUAL', 'PROBATIONARY'].map((value) => ({
                          value,
                          label: plainName(value),
                        })),
                      },
                      { name: 'startDate', label: 'Employment start', type: 'date' },
                      {
                        name: 'endDate',
                        label: 'Contract end',
                        type: 'date',
                        showWhen: { field: 'type', values: ['CONTRACTUAL'] },
                      },
                      {
                        name: 'probationEnd',
                        label: 'Probation review',
                        type: 'date',
                        showWhen: { field: 'type', values: ['PROBATIONARY'] },
                      },
                      reason,
                    ]}
                    onSubmit={(v) => save(`employees/${id}/employment-records`, v)}
                  />
                )}
                {employeeTab === 3 && (can('PERMISSION_ASSIGN') || user.position === 'SENIOR_DIRECTOR') && (
                  <ModalForm
                    buttonLabel="Manage permissions"
                    title="Manage permissions"
                    fields={[
                      {
                        name: 'code',
                        label: 'Permission',
                        options: PERMISSIONS.filter((permission) =>
                          canRoleHoldPermission(detail.position, detail.department?.kind === 'HR', permission),
                        ).map((value) => ({ value, label: permissionName(value) })),
                      },
                      {
                        name: 'action',
                        label: 'Change',
                        options: [
                          { value: 'grant', label: 'Grant' },
                          { value: 'revoke', label: 'Revoke' },
                        ],
                      },
                      reason,
                    ]}
                    onSubmit={async ({ action, ...v }) =>
                      save(`employees/${id}/permissions${action === 'revoke' ? '/revoke' : ''}`, v)
                    }
                  />
                )}
                {employeeTab === 2 && can('LEAVE_POLICY_MANAGE') && (
                  <ModalForm
                    buttonLabel="Assign leave policy"
                    title="Assign next-year leave policy"
                    fields={[
                      { name: 'policyVersionId', label: 'Policy', options: policyOptions },
                      { name: 'year', label: 'Leave year', type: 'number', value: new Date().getFullYear() + 1 },
                    ]}
                    onSubmit={(v) => save(`employees/${id}/leave-policy`, v)}
                  />
                )}
                {employeeTab === 2 && can('CHRISTMAS_POLICY_MANAGE') && (
                  <ModalForm
                    buttonLabel="Assign Christmas policy"
                    title="Assign next-year Christmas policy"
                    fields={[
                      { name: 'policyVersionId', label: 'Policy', options: christmasOptions },
                      { name: 'year', label: 'Leave year', type: 'number', value: new Date().getFullYear() + 1 },
                    ]}
                    onSubmit={(v) => save(`employees/${id}/christmas-policy`, v)}
                  />
                )}
              </Stack>
            }
          />
        </>
      )}
      {credentialDialog}
    </Stack>
  );
}

import AddOutlined from '@mui/icons-material/AddOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { CurrentEmployee } from '@tms/contracts';
import { Card, ModalForm, StatusTag } from './ui';
import type { Policy } from './organization-types';

export function OrganizationPoliciesView({
  can,
  error,
  policies,
  save,
  search,
  setSearch,
  setTab,
  tab,
}: {
  can: (permission: CurrentEmployee['permissions'][number]) => boolean;
  error: string;
  policies: { leave: Policy[]; christmas: Policy[] };
  save: (endpoint: string, values: Record<string, string | number>, method?: string) => Promise<void>;
  search: string;
  setSearch: (value: string) => void;
  setTab: (value: number) => void;
  tab: number;
}) {
  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      <Card title="Policy catalogue">
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Tabs value={tab} onChange={(_, value: number) => setTab(value)} aria-label="Policy types">
            <Tab label={`Regular leave (${policies.leave.length})`} />
            <Tab label={`Christmas (${policies.christmas.length})`} />
          </Tabs>
          <TextField label="Search policies" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Stack>
        <div className="policy-grid">
          {(tab === 0 ? policies.leave : policies.christmas)
            .filter((policy) => policy.name.toLowerCase().includes(search.toLowerCase()))
            .map((policy) => {
              const allowance =
                tab === 0
                  ? `${policy.leavePolicyVersion_policy?.[0]?.vacationDays} vacation · ${policy.leavePolicyVersion_policy?.[0]?.sickDays} sick`
                  : `${policy.christmasPolicyVersion_policy?.[0]?.days} Christmas days`;
              return (
                <div className="policy-tile" key={policy.id}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                    <Typography sx={{ fontWeight: 700 }}>{policy.name}</Typography>
                    <StatusTag value={policy.status} />
                  </Stack>
                  <Typography variant="h6" sx={{ mt: 2 }}>
                    {allowance}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Current version · annual entitlement
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    {((tab === 0 && can('LEAVE_POLICY_MANAGE')) || (tab === 1 && can('CHRISTMAS_POLICY_MANAGE'))) && (
                      <ModalForm
                        buttonLabel="New version"
                        title={`Create a new version of ${policy.name}`}
                        fields={
                          tab === 0
                            ? [
                                { name: 'name', label: 'Policy name', value: policy.name },
                                {
                                  name: 'vacationDays',
                                  label: 'Vacation days',
                                  type: 'number',
                                  value: policy.leavePolicyVersion_policy?.[0]?.vacationDays,
                                },
                                {
                                  name: 'sickDays',
                                  label: 'Sick days',
                                  type: 'number',
                                  value: policy.leavePolicyVersion_policy?.[0]?.sickDays,
                                },
                              ]
                            : [
                                { name: 'name', label: 'Policy name', value: policy.name },
                                {
                                  name: 'days',
                                  label: 'Days',
                                  type: 'number',
                                  value: policy.christmasPolicyVersion_policy?.[0]?.days,
                                },
                              ]
                        }
                        onSubmit={(values) =>
                          save(`${tab === 0 ? 'leave' : 'christmas'}-policies/${policy.id}/versions`, values)
                        }
                      />
                    )}
                    {((tab === 0 && can('LEAVE_POLICY_MANAGE')) || (tab === 1 && can('CHRISTMAS_POLICY_MANAGE'))) && (
                      <Button
                        color="primary"
                        variant="outlined"
                        onClick={() =>
                          save(`${tab === 0 ? 'leave' : 'christmas'}-policies/${policy.id}/status`, {
                            status: policy.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          })
                        }
                      >
                        {policy.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </Stack>
                </div>
              );
            })}
        </div>
      </Card>
      <Card title="Policy actions" className="action-bar">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          {can('LEAVE_POLICY_MANAGE') && (
            <ModalForm
              buttonLabel="Create leave policy"
              icon={<AddOutlined />}
              title="Create leave policy"
              variant="contained"
              fields={[
                { name: 'name', label: 'Policy name' },
                { name: 'vacationDays', label: 'Vacation days', type: 'number' },
                { name: 'sickDays', label: 'Sick days', type: 'number' },
              ]}
              onSubmit={(v) => save('leave-policies', v)}
            />
          )}
          {can('CHRISTMAS_POLICY_MANAGE') && (
            <ModalForm
              buttonLabel="Create Christmas policy"
              icon={<AddOutlined />}
              title="Create Christmas policy"
              fields={[
                { name: 'name', label: 'Policy name' },
                { name: 'days', label: 'Days', type: 'number' },
              ]}
              onSubmit={(v) => save('christmas-policies', v)}
            />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

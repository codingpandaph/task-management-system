import { test } from '@playwright/test';
import { registerCoreScenarios } from './hr-core.scenarios';
import { registerManagementScenarios } from './hr-management.scenarios';

test.describe.serial('HRIS journeys', () => {
  registerCoreScenarios();
  registerManagementScenarios();
});

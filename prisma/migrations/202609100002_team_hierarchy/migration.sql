CREATE TABLE "Team" (
  "id" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "taskManagementTypes" "TaskManagementType"[] NOT NULL DEFAULT ARRAY['KANBAN']::"TaskManagementType"[],
  "kanbanWipLimit" INTEGER NOT NULL DEFAULT 3,
  "departmentId" UUID NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Team_departmentId_code_key" ON "Team"("departmentId", "code");
CREATE UNIQUE INDEX "Team_departmentId_name_key" ON "Team"("departmentId", "name");
CREATE INDEX "Team_departmentId_status_idx" ON "Team"("departmentId", "status");
ALTER TABLE "Team" ADD CONSTRAINT "Team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Employee" ADD COLUMN "teamId" UUID;
ALTER TABLE "EmployeeOrganizationHistory" ADD COLUMN "teamId" UUID;
ALTER TABLE "Workspace" ADD COLUMN "teamId" UUID;
ALTER TABLE "LeaveApprovalStep" ADD COLUMN "teamId" UUID;
ALTER TABLE "LeaveCancellationApprovalStep" ADD COLUMN "teamId" UUID;

INSERT INTO "Team" ("id", "updatedAt", "code", "name", "taskManagementTypes", "kanbanWipLimit", "departmentId")
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, 'CORE', d."name" || ' Team', d."taskManagementTypes", d."kanbanWipLimit", d."id"
FROM "Department" d;

UPDATE "Employee" e
SET "teamId" = t."id"
FROM "Team" t
WHERE t."departmentId" = e."departmentId" AND e."position" IN ('ACCOUNT_DIRECTOR', 'MEMBER');

UPDATE "EmployeeOrganizationHistory" h
SET "teamId" = t."id"
FROM "Team" t
WHERE t."departmentId" = h."departmentId" AND h."position" IN ('ACCOUNT_DIRECTOR', 'MEMBER');

UPDATE "Workspace" w
SET "teamId" = t."id"
FROM "Team" t
WHERE t."departmentId" = w."departmentId";

UPDATE "Employee" SET "position" = 'MANAGING_DIRECTOR' WHERE "position" = 'SENIOR_DIRECTOR' AND "departmentId" IS NULL;
UPDATE "EmployeeOrganizationHistory" SET "position" = 'MANAGING_DIRECTOR' WHERE "position" = 'SENIOR_DIRECTOR' AND "departmentId" IS NULL;

ALTER TABLE "Employee" DROP CONSTRAINT "employee_department_matches_position";
ALTER TABLE "Employee" ADD CONSTRAINT "employee_hierarchy_matches_position" CHECK (
  ("position" = 'MANAGING_DIRECTOR' AND "departmentId" IS NULL AND "teamId" IS NULL)
  OR ("position" = 'SENIOR_DIRECTOR' AND "departmentId" IS NOT NULL AND "teamId" IS NULL)
  OR ("position" IN ('ACCOUNT_DIRECTOR', 'MEMBER') AND "departmentId" IS NOT NULL AND "teamId" IS NOT NULL)
);

DROP INDEX "one_active_senior_director";
DROP INDEX "one_active_department_director";
CREATE UNIQUE INDEX one_active_managing_director ON "Employee" (position)
  WHERE position = 'MANAGING_DIRECTOR' AND status = 'ACTIVE';
CREATE UNIQUE INDEX one_active_department_senior_director ON "Employee" ("departmentId")
  WHERE position = 'SENIOR_DIRECTOR' AND status = 'ACTIVE';
CREATE UNIQUE INDEX one_active_team_account_director ON "Employee" ("teamId")
  WHERE position = 'ACCOUNT_DIRECTOR' AND status = 'ACTIVE';

ALTER TABLE "Workspace" ALTER COLUMN "teamId" SET NOT NULL;
DROP INDEX "Workspace_departmentId_key";
CREATE INDEX "Workspace_departmentId_idx" ON "Workspace"("departmentId");
CREATE UNIQUE INDEX "Workspace_teamId_key" ON "Workspace"("teamId");
CREATE INDEX "Employee_teamId_status_position_idx" ON "Employee"("teamId", "status", "position");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeOrganizationHistory" ADD CONSTRAINT "EmployeeOrganizationHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveCancellationApprovalStep" ADD CONSTRAINT "LeaveCancellationApprovalStep_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

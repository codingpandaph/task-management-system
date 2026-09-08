ALTER TABLE "Employee" ALTER COLUMN "departmentId" DROP NOT NULL;
ALTER TABLE "EmployeeOrganizationHistory" ALTER COLUMN "departmentId" DROP NOT NULL;

UPDATE "Employee" SET "departmentId" = NULL WHERE "position" = 'SENIOR_DIRECTOR';

ALTER TABLE "Employee" ADD CONSTRAINT "employee_department_matches_position" CHECK (
  ("position" = 'SENIOR_DIRECTOR' AND "departmentId" IS NULL)
  OR ("position" <> 'SENIOR_DIRECTOR' AND "departmentId" IS NOT NULL)
);

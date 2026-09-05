-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DepartmentKind" AS ENUM ('OPERATIONAL', 'HR');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('SENIOR_DIRECTOR', 'ACCOUNT_DIRECTOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'CONTRACTUAL', 'PROBATIONARY');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('VACATION', 'SICK', 'CHRISTMAS_VACATION');

-- CreateEnum
CREATE TYPE "LeaveSource" AS ENUM ('EMPLOYEE', 'ADMINISTRATIVE');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('ACCOUNT_DIRECTOR', 'SENIOR_DIRECTOR', 'HR');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('ANNUAL_ENTITLEMENT', 'MANUAL_ADJUSTMENT', 'PENDING_RESERVATION', 'RESERVATION_RELEASE', 'APPROVED_LEAVE', 'CANCELLATION_REVERSAL');

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "calendarId" UUID NOT NULL,
    "hrApproverId" UUID,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "kind" "DepartmentKind" NOT NULL DEFAULT 'OPERATIONAL',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "position" "Position" NOT NULL DEFAULT 'MEMBER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "departmentId" UUID NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOrganizationHistory" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "position" "Position" NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMPTZ(3),
    "reason" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "actorId" UUID,
    "departmentId" UUID NOT NULL,

    CONSTRAINT "EmployeeOrganizationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentRecord" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "type" "EmploymentType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "probationEnd" DATE,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMPTZ(3),
    "reason" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "actorId" UUID,

    CONSTRAINT "EmploymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeStatusChange" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "previous" "AccountStatus" NOT NULL,
    "next" "AccountStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "actorId" UUID,

    CONSTRAINT "EmployeeStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suspension" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "previousAccessState" "AccountStatus" NOT NULL,
    "suspendedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedUntil" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),
    "reason" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "actorId" UUID,

    CONSTRAINT "Suspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "delegable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePermission" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "employeeId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "grantedById" UUID,
    "revokedById" UUID,

    CONSTRAINT "EmployeePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicyVersion" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "number" INTEGER NOT NULL,
    "vacationDays" INTEGER NOT NULL,
    "sickDays" INTEGER NOT NULL,
    "actorId" UUID,
    "policyId" UUID NOT NULL,

    CONSTRAINT "LeavePolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChristmasPolicy" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ChristmasPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChristmasPolicyVersion" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "number" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "actorId" UUID,
    "policyId" UUID NOT NULL,

    CONSTRAINT "ChristmasPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLeavePolicyAssignment" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "employeeId" UUID NOT NULL,
    "actorId" UUID,
    "policyVersionId" UUID NOT NULL,

    CONSTRAINT "EmployeeLeavePolicyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeChristmasPolicyAssignment" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "employeeId" UUID NOT NULL,
    "actorId" UUID,
    "policyVersionId" UUID NOT NULL,

    CONSTRAINT "EmployeeChristmasPolicyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingCalendar" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "coverageStart" DATE NOT NULL,
    "coverageEnd" DATE NOT NULL,

    CONSTRAINT "WorkingCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarWorkingDay" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "weekday" INTEGER NOT NULL,
    "calendarId" UUID NOT NULL,

    CONSTRAINT "CalendarWorkingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "calendarId" UUID NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLeaveYear" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "employeeId" UUID NOT NULL,
    "calendarId" UUID NOT NULL,

    CONSTRAINT "EmployeeLeaveYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveAccount" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "type" "LeaveType" NOT NULL,
    "leaveYearId" UUID NOT NULL,

    CONSTRAINT "LeaveAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "source" "LeaveSource" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "LeaveStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "administrativeReason" TEXT,
    "operationKey" TEXT,
    "employeeId" UUID NOT NULL,
    "accountId" UUID,
    "submittedById" UUID,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequestDay" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "date" DATE NOT NULL,
    "requestId" UUID NOT NULL,

    CONSTRAINT "LeaveRequestDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalStep" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "actedAt" TIMESTAMPTZ(3),
    "reason" TEXT,
    "requestId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "departmentId" UUID,

    CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveCancellationRequest" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "operationKey" TEXT NOT NULL,
    "requestId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,

    CONSTRAINT "LeaveCancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveCancellationApprovalStep" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "actedAt" TIMESTAMPTZ(3),
    "reason" TEXT,
    "cancellationId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "departmentId" UUID,

    CONSTRAINT "LeaveCancellationApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveLedgerEntry" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "type" "LedgerType" NOT NULL,
    "entitlementDelta" INTEGER NOT NULL DEFAULT 0,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "usedDelta" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "postingKey" TEXT NOT NULL,
    "actorId" UUID,
    "requestId" UUID,
    "accountId" UUID NOT NULL,
    "cancellationId" UUID,

    CONSTRAINT "LeaveLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokeReason" TEXT,
    "csrfHash" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshCredential" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "digest" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "sessionId" UUID NOT NULL,

    CONSTRAINT "RefreshCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "dedupeKey" TEXT NOT NULL,
    "recipientId" UUID NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "actorId" UUID,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeId_key" ON "Employee"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_status_position_idx" ON "Employee"("departmentId", "status", "position");

-- CreateIndex
CREATE INDEX "EmploymentRecord_endDate_effectiveTo_idx" ON "EmploymentRecord"("endDate", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_name_key" ON "LeavePolicy"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicyVersion_policyId_number_key" ON "LeavePolicyVersion"("policyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ChristmasPolicy_name_key" ON "ChristmasPolicy"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ChristmasPolicyVersion_policyId_number_key" ON "ChristmasPolicyVersion"("policyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeLeavePolicyAssignment_employeeId_year_key" ON "EmployeeLeavePolicyAssignment"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeChristmasPolicyAssignment_employeeId_year_key" ON "EmployeeChristmasPolicyAssignment"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingCalendar_code_key" ON "WorkingCalendar"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarWorkingDay_calendarId_weekday_key" ON "CalendarWorkingDay"("calendarId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_calendarId_date_key" ON "Holiday"("calendarId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeLeaveYear_employeeId_year_key" ON "EmployeeLeaveYear"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveAccount_leaveYearId_type_key" ON "LeaveAccount"("leaveYearId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_operationKey_key" ON "LeaveRequest"("operationKey");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_startDate_endDate_status_idx" ON "LeaveRequest"("employeeId", "startDate", "endDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequestDay_requestId_date_key" ON "LeaveRequestDay"("requestId", "date");

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_approverId_status_idx" ON "LeaveApprovalStep"("approverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalStep_requestId_sequence_key" ON "LeaveApprovalStep"("requestId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveCancellationRequest_operationKey_key" ON "LeaveCancellationRequest"("operationKey");

-- CreateIndex
CREATE INDEX "LeaveCancellationApprovalStep_approverId_status_idx" ON "LeaveCancellationApprovalStep"("approverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveCancellationApprovalStep_cancellationId_sequence_key" ON "LeaveCancellationApprovalStep"("cancellationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveLedgerEntry_postingKey_key" ON "LeaveLedgerEntry"("postingKey");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshCredential_digest_key" ON "RefreshCredential"("digest");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_createdAt_idx" ON "AuditEvent"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_hrApproverId_fkey" FOREIGN KEY ("hrApproverId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOrganizationHistory" ADD CONSTRAINT "EmployeeOrganizationHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOrganizationHistory" ADD CONSTRAINT "EmployeeOrganizationHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOrganizationHistory" ADD CONSTRAINT "EmployeeOrganizationHistory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT "EmploymentRecord_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatusChange" ADD CONSTRAINT "EmployeeStatusChange_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatusChange" ADD CONSTRAINT "EmployeeStatusChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePermission" ADD CONSTRAINT "EmployeePermission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePermission" ADD CONSTRAINT "EmployeePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePermission" ADD CONSTRAINT "EmployeePermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePermission" ADD CONSTRAINT "EmployeePermission_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyVersion" ADD CONSTRAINT "LeavePolicyVersion_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyVersion" ADD CONSTRAINT "LeavePolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChristmasPolicyVersion" ADD CONSTRAINT "ChristmasPolicyVersion_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChristmasPolicyVersion" ADD CONSTRAINT "ChristmasPolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ChristmasPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeavePolicyAssignment" ADD CONSTRAINT "EmployeeLeavePolicyAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeavePolicyAssignment" ADD CONSTRAINT "EmployeeLeavePolicyAssignment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeavePolicyAssignment" ADD CONSTRAINT "EmployeeLeavePolicyAssignment_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "LeavePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeChristmasPolicyAssignment" ADD CONSTRAINT "EmployeeChristmasPolicyAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeChristmasPolicyAssignment" ADD CONSTRAINT "EmployeeChristmasPolicyAssignment_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeChristmasPolicyAssignment" ADD CONSTRAINT "EmployeeChristmasPolicyAssignment_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "ChristmasPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarWorkingDay" ADD CONSTRAINT "CalendarWorkingDay_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveYear" ADD CONSTRAINT "EmployeeLeaveYear_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveYear" ADD CONSTRAINT "EmployeeLeaveYear_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "WorkingCalendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveAccount" ADD CONSTRAINT "LeaveAccount_leaveYearId_fkey" FOREIGN KEY ("leaveYearId") REFERENCES "EmployeeLeaveYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LeaveAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequestDay" ADD CONSTRAINT "LeaveRequestDay_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveCancellationRequest" ADD CONSTRAINT "LeaveCancellationRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveCancellationRequest" ADD CONSTRAINT "LeaveCancellationRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveCancellationApprovalStep" ADD CONSTRAINT "LeaveCancellationApprovalStep_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "LeaveCancellationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveCancellationApprovalStep" ADD CONSTRAINT "LeaveCancellationApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveCancellationApprovalStep" ADD CONSTRAINT "LeaveCancellationApprovalStep_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LeaveAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "LeaveCancellationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Critical business invariants not expressible in ordinary Prisma attributes.
CREATE SEQUENCE employee_id_sequence AS bigint MINVALUE 1 MAXVALUE 999999 NO CYCLE;
CREATE UNIQUE INDEX one_organization ON "OrganizationSettings" ((true));
CREATE UNIQUE INDEX one_hr_department ON "Department" (kind) WHERE kind = 'HR';
CREATE UNIQUE INDEX one_active_senior_director ON "Employee" (position) WHERE position = 'SENIOR_DIRECTOR' AND status = 'ACTIVE';
CREATE UNIQUE INDEX one_active_department_director ON "Employee" ("departmentId") WHERE position = 'ACCOUNT_DIRECTOR' AND status = 'ACTIVE';
CREATE UNIQUE INDEX one_current_employment ON "EmploymentRecord" ("employeeId") WHERE "effectiveTo" IS NULL;
CREATE UNIQUE INDEX one_current_membership ON "EmployeeOrganizationHistory" ("employeeId") WHERE "effectiveTo" IS NULL;
CREATE UNIQUE INDEX one_open_suspension ON "Suspension" ("employeeId") WHERE "resolvedAt" IS NULL;
CREATE UNIQUE INDEX one_current_grant ON "EmployeePermission" ("employeeId", "permissionId") WHERE "revokedAt" IS NULL;
CREATE UNIQUE INDEX one_current_refresh ON "RefreshCredential" ("sessionId") WHERE "consumedAt" IS NULL;
CREATE UNIQUE INDEX one_pending_cancellation ON "LeaveCancellationRequest" ("requestId") WHERE status = 'PENDING';
ALTER TABLE "EmploymentRecord" ADD CONSTRAINT employment_dates CHECK (
  ("endDate" IS NULL OR "endDate" >= "startDate") AND
  ("probationEnd" IS NULL OR "probationEnd" >= "startDate") AND
  (type <> 'CONTRACTUAL' OR "endDate" IS NOT NULL) AND
  (type <> 'PROBATIONARY' OR "probationEnd" IS NOT NULL));
ALTER TABLE "LeavePolicyVersion" ADD CONSTRAINT positive_allowance CHECK ("vacationDays" >= 0 AND "sickDays" >= 0);
ALTER TABLE "ChristmasPolicyVersion" ADD CONSTRAINT positive_christmas CHECK (days >= 0);
ALTER TABLE "LeaveRequest" ADD CONSTRAINT leave_dates CHECK ("endDate" >= "startDate");
ALTER TABLE "Suspension" ADD CONSTRAINT suspension_dates CHECK ("suspendedUntil" > "suspendedAt");
ALTER TABLE "CalendarWorkingDay" ADD CONSTRAINT valid_weekday CHECK (weekday BETWEEN 0 AND 6);
CREATE FUNCTION protect_employee_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."employeeId" <> OLD."employeeId" THEN RAISE EXCEPTION 'Employee ID is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER employee_id_immutable BEFORE UPDATE ON "Employee" FOR EACH ROW EXECUTE FUNCTION protect_employee_id();
CREATE FUNCTION protect_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical records are append-only'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION protect_append_only();
CREATE TRIGGER ledger_append_only BEFORE UPDATE OR DELETE ON "LeaveLedgerEntry" FOR EACH ROW EXECUTE FUNCTION protect_append_only();
CREATE TRIGGER leave_policy_immutable BEFORE UPDATE OR DELETE ON "LeavePolicyVersion" FOR EACH ROW EXECUTE FUNCTION protect_append_only();
CREATE TRIGGER christmas_policy_immutable BEFORE UPDATE OR DELETE ON "ChristmasPolicyVersion" FOR EACH ROW EXECUTE FUNCTION protect_append_only();

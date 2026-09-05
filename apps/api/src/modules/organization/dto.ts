import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PERMISSIONS, type PermissionCode } from '@tms/contracts';
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsIn(['MEMBER', 'ACCOUNT_DIRECTOR', 'SENIOR_DIRECTOR']) position?:
    'MEMBER' | 'ACCOUNT_DIRECTOR' | 'SENIOR_DIRECTOR';
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED']) status?:
    'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';
  @IsOptional() @IsIn(['FULL_TIME', 'CONTRACTUAL', 'PROBATIONARY']) employmentType?:
    'FULL_TIME' | 'CONTRACTUAL' | 'PROBATIONARY';
}
export class ReasonDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class DepartmentDto {
  @IsString() @Matches(/^[A-Z0-9]{2,10}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
}
export class EditDepartmentDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsInt() @Min(1) version!: number;
}
export class EmployeeDto {
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsOptional() @IsString() @MaxLength(80) middleName?: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) birthDate!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsUUID() departmentId!: string;
  @IsIn(['FULL_TIME', 'CONTRACTUAL', 'PROBATIONARY']) employmentType!: 'FULL_TIME' | 'CONTRACTUAL' | 'PROBATIONARY';
  @IsString() startDate!: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() probationEnd?: string;
  @IsUUID() leavePolicyVersionId!: string;
  @IsUUID() christmasPolicyVersionId!: string;
}
export class EditEmployeeDto {
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsOptional() @IsString() @MaxLength(80) middleName?: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsInt() @Min(1) version!: number;
}
export class EmploymentDto extends ReasonDto {
  @IsIn(['FULL_TIME', 'CONTRACTUAL', 'PROBATIONARY']) type!: 'FULL_TIME' | 'CONTRACTUAL' | 'PROBATIONARY';
  @IsString() startDate!: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() probationEnd?: string;
}
export class AssignmentDto extends ReasonDto {
  @IsUUID() employeeId!: string;
}
export class TransferDto extends ReasonDto {
  @IsUUID() departmentId!: string;
}
export class SuspendDto extends ReasonDto {
  @IsString() suspendedUntil!: string;
}
export class PermissionDto extends ReasonDto {
  @IsIn(PERMISSIONS) code!: PermissionCode;
}

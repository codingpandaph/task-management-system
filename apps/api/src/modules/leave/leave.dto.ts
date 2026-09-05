import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
export class LeaveDto {
  @IsIn(['VACATION', 'SICK', 'CHRISTMAS_VACATION']) type!: 'VACATION' | 'SICK' | 'CHRISTMAS_VACATION';
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class SubmitDto {
  @IsUUID() operationId!: string;
}
export class AdminLeaveDto extends LeaveDto {
  @IsUUID() employeeId!: string;
  @IsUUID() operationId!: string;
  @IsString() @MinLength(3) @MaxLength(500) administrativeReason!: string;
}
export class DecisionDto {
  @IsIn(['APPROVED', 'REJECTED']) decision!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class CancellationDto extends SubmitDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class AdjustmentDto extends SubmitDto {
  @IsUUID() employeeId!: string;
  @IsInt() @Min(2020) @Max(2200) year!: number;
  @IsIn(['VACATION', 'SICK', 'CHRISTMAS_VACATION']) type!: 'VACATION' | 'SICK' | 'CHRISTMAS_VACATION';
  @IsInt() @Min(-366) @Max(366) days!: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum WorkspaceFunctionDto {
  ENGINEERING_PRODUCT = 'ENGINEERING_PRODUCT',
  MARKETING_CREATIVE = 'MARKETING_CREATIVE',
  SALES_ACCOUNT_MANAGEMENT = 'SALES_ACCOUNT_MANAGEMENT',
  HR_OPERATIONS = 'HR_OPERATIONS',
  FINANCE_LEGAL = 'FINANCE_LEGAL',
}
export enum TaskPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}
export enum TaskLinkTypeDto {
  BLOCKS = 'BLOCKS',
  BLOCKED_BY = 'BLOCKED_BY',
  RELATES_TO = 'RELATES_TO',
}
export class WorkspaceDto {
  @IsUUID() departmentId!: string;
  @IsEnum(WorkspaceFunctionDto) function!: keyof typeof WorkspaceFunctionDto;
}
export class ColumnDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsBoolean() isDone?: boolean;
  @IsOptional() @IsBoolean() managementLocked?: boolean;
}
export class BoardDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ColumnDto) columns!: ColumnDto[];
}
export class MilestoneDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) goal!: string;
  @IsDateString({ strict: true }) startDate!: string;
  @IsDateString() dueDate!: string;
}
export class TaskDto {
  @IsUUID() workspaceId!: string;
  @IsUUID() boardId!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsEnum(TaskPriorityDto) priority!: keyof typeof TaskPriorityDto;
  @Type(() => Number) @IsNumber() @Min(0) @Max(10000) estimatedHours!: number;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsUUID() milestoneId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @MaxLength(500, { each: true }) definitionOfDone?: string[];
}
export class TaskEditDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(20000) description?: string;
  @IsOptional() @IsEnum(TaskPriorityDto) priority?: keyof typeof TaskPriorityDto;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10000) estimatedHours?: number;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsBoolean() clearAssignee?: boolean;
  @IsOptional() @IsUUID() milestoneId?: string;
  @IsOptional() @IsBoolean() clearMilestone?: boolean;
}
export class MoveTaskDto {
  @IsUUID() columnId!: string;
}
export class ApprovalDto {
  @IsBoolean() approved!: boolean;
}
export class EscalationDto {
  @IsBoolean() escalated!: boolean;
}
export class DodDto {
  @IsString() @IsNotEmpty() @MaxLength(500) item!: string;
}
export class DodCheckDto {
  @IsBoolean() isChecked!: boolean;
}
export class LinkDto {
  @IsUUID() targetTaskId!: string;
  @IsEnum(TaskLinkTypeDto) type!: keyof typeof TaskLinkTypeDto;
}
export class CommentDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
}
export class MembershipDto {
  @IsUUID() employeeId!: string;
  @IsOptional() @IsUUID() milestoneId?: string;
  @IsOptional() @IsDateString({ strict: true }) effectiveFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) effectiveTo?: string;
}

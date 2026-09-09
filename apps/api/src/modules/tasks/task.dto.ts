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
  IsUrl,
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
export enum TaskManagementTypeDto {
  KANBAN = 'KANBAN',
  SCRUM = 'SCRUM',
  LIST = 'LIST',
}
export enum SprintStatusDto {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}
export enum TaskColumnSemanticDto {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
  OPEN = 'OPEN',
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
  @IsOptional() @IsEnum(TaskColumnSemanticDto) semantic?: keyof typeof TaskColumnSemanticDto;
  @IsOptional() @IsBoolean() isDone?: boolean;
  @IsOptional() @IsBoolean() managementLocked?: boolean;
}
export class BoardDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsEnum(TaskManagementTypeDto) kind?: keyof typeof TaskManagementTypeDto;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ColumnDto)
  columns?: ColumnDto[];
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
  @IsOptional() @IsUUID() sprintId?: string;
  @IsOptional() @IsDateString({ strict: true }) dueDate?: string;
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
  @IsOptional() @IsUUID() sprintId?: string;
  @IsOptional() @IsBoolean() clearSprint?: boolean;
  @IsOptional() @IsDateString({ strict: true }) dueDate?: string;
  @IsOptional() @IsBoolean() clearDueDate?: boolean;
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
export class LinkDto {
  @IsUUID() targetTaskId!: string;
  @IsEnum(TaskLinkTypeDto) type!: keyof typeof TaskLinkTypeDto;
}
export class CommentDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
}
export class AttachmentDto {
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2000) url!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) mediaType!: string;
  @Type(() => Number) @IsNumber() @Min(1) @Max(25_000_000) sizeBytes!: number;
}
export class SavedViewDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsUUID() workspaceId!: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsEnum(TaskPriorityDto) priority?: keyof typeof TaskPriorityDto;
  @IsOptional() @IsUUID() assigneeId?: string;
}
export class BulkTaskDto {
  @IsArray() @ArrayMaxSize(50) @IsUUID('4', { each: true }) taskIds!: string[];
  @IsOptional() @IsEnum(TaskPriorityDto) priority?: keyof typeof TaskPriorityDto;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsBoolean() clearAssignee?: boolean;
  @IsOptional() @IsUUID() columnId?: string;
}
export class MembershipDto {
  @IsUUID() employeeId!: string;
  @IsOptional() @IsUUID() milestoneId?: string;
  @IsOptional() @IsDateString({ strict: true }) effectiveFrom?: string;
  @IsOptional() @IsDateString({ strict: true }) effectiveTo?: string;
  @IsOptional() @IsBoolean() canCreateTasks?: boolean;
  @IsOptional() @IsBoolean() canCreateBoards?: boolean;
}
export class CollaboratorDto {
  @IsUUID() employeeId!: string;
}
export class SprintDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) goal!: string;
  @IsDateString({ strict: true }) startDate!: string;
  @IsDateString({ strict: true }) endDate!: string;
}

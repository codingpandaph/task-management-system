import { Body, Controller, Delete, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { AuthRequest } from '../authorization/authorization';
import {
  ApprovalDto,
  BoardDto,
  CommentDto,
  DodCheckDto,
  DodDto,
  EscalationDto,
  LinkDto,
  MembershipDto,
  MilestoneDto,
  MoveTaskDto,
  TaskDto,
  TaskEditDto,
  WorkspaceDto,
} from './task.dto';
import { TaskService } from './task.service';

@Controller()
class TaskController {
  constructor(private readonly service: TaskService) {}

  @Get('task-workspaces') workspaces(@Req() request: AuthRequest) {
    return this.service.workspaces(request.principal);
  }
  @Post('task-workspaces') createWorkspace(@Req() request: AuthRequest, @Body() dto: WorkspaceDto) {
    return this.service.createWorkspace(request.principal, dto.departmentId, dto.function);
  }
  @Post('task-workspaces/:id/boards') board(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BoardDto,
  ) {
    return this.service.createBoard(request.principal, id, dto);
  }
  @Post('task-workspaces/:id/memberships') membership(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MembershipDto,
  ) {
    return this.service.addMembership(request.principal, id, dto);
  }
  @Post('task-workspaces/:id/milestones') milestone(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MilestoneDto,
  ) {
    return this.service.createMilestone(request.principal, id, dto);
  }
  @Get('task-workspaces/:id/board') taskBoard(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('boardId') boardId?: string,
  ) {
    return this.service.board(request.principal, id, boardId);
  }
  @Get('tasks/mine') mine(@Req() request: AuthRequest) {
    return this.service.myTasks(request.principal);
  }
  @Get('tasks/reporting') reporting(@Req() request: AuthRequest) {
    return this.service.reporting(request.principal);
  }
  @Get('tasks/archived') archived(@Req() request: AuthRequest) {
    return this.service.archived(request.principal);
  }
  @Post('tasks') create(@Req() request: AuthRequest, @Body() dto: TaskDto) {
    return this.service.createTask(request.principal, dto);
  }
  @Get('tasks/:id') detail(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(request.principal, id);
  }
  @Patch('tasks/:id') edit(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskEditDto,
  ) {
    return this.service.edit(request.principal, id, dto);
  }
  @Post('tasks/:id/move') move(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.service.move(request.principal, id, dto.columnId);
  }
  @Post('tasks/:id/management-approval') approve(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalDto,
  ) {
    return this.service.approve(request.principal, id, dto.approved);
  }
  @Post('tasks/:id/escalation') escalate(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalationDto,
  ) {
    return this.service.escalate(request.principal, id, dto.escalated);
  }
  @Delete('tasks/:id') remove(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(request.principal, id);
  }
  @Post('tasks/:id/restore') restore(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.restore(request.principal, id);
  }
  @Post('tasks/:id/definition-of-done') addDod(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DodDto,
  ) {
    return this.service.addDod(request.principal, id, dto.item);
  }
  @Patch('tasks/:taskId/definition-of-done/:itemId') checkDod(
    @Req() request: AuthRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: DodCheckDto,
  ) {
    return this.service.checkDod(request.principal, taskId, itemId, dto.isChecked);
  }
  @Post('tasks/:id/links') link(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkDto,
  ) {
    return this.service.link(request.principal, id, dto.targetTaskId, dto.type);
  }
  @Post('tasks/:id/comments') comment(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommentDto,
  ) {
    return this.service.comment(request.principal, id, dto.body);
  }
  @Post('milestones/:id/close') closeMilestone(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.closeMilestone(request.principal, id);
  }
  @Get('milestones/:id/capacity') capacity(@Req() request: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.capacity(request.principal, id);
  }
}

@Module({ controllers: [TaskController], providers: [TaskService], exports: [TaskService] })
export class TaskModule {}

import { Body, Controller, Get, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { today } from '../../common/dates';
import { AuthRequest } from '../authorization/authorization';
import { PageDto } from '../organization/dto';
import { LeaveApprovalResolver } from './approval.service';
import { LeaveBalanceService } from './balance.service';
import { AdjustmentDto, AdminLeaveDto, CancellationDto, DecisionDto, LeaveDto, SubmitDto } from './leave.dto';
import { LeaveService } from './leave.service';
@Controller()
class LeaveController {
  constructor(private readonly service: LeaveService) {}
  @Get('leave/balances') balances(@Req() r: AuthRequest, @Query('year') year?: string) {
    return this.service.balance(r.principal, Number(year ?? today().slice(0, 4)));
  }
  @Post('leave/preview') preview(@Req() r: AuthRequest, @Body() d: LeaveDto) {
    return this.service.preview(r.principal, d);
  }
  @Get('leave/requests') list(@Req() r: AuthRequest, @Query() q: PageDto) {
    return this.service.list(r.principal, q);
  }
  @Post('leave/requests') draft(@Req() r: AuthRequest, @Body() d: LeaveDto) {
    return this.service.draft(r.principal, d);
  }
  @Patch('leave/requests/:id') edit(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: LeaveDto,
  ) {
    return this.service.draft(r.principal, d, id);
  }
  @Get('leave/requests/:id') detail(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(r.principal, id);
  }
  @Post('leave/requests/:id/submit') submit(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: SubmitDto,
  ) {
    return this.service.submit(r.principal, id, d.operationId);
  }
  @Post('leave/requests/:id/cancel') cancel(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CancellationDto,
  ) {
    return this.service.cancel(r.principal, id, d);
  }
  @Get('approvals') approvals(@Req() r: AuthRequest) {
    return this.service.inbox(r.principal);
  }
  @Post('leave/requests/:id/decision') decide(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DecisionDto,
  ) {
    return this.service.decide(r.principal, id, d);
  }
  @Post('leave/cancellations/:id/decision') cancellation(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: DecisionDto,
  ) {
    return this.service.decideCancellation(r.principal, id, d);
  }
  @Get('hr/leave') adminList(@Req() r: AuthRequest, @Query() q: PageDto) {
    return this.service.list(r.principal, q, true);
  }
  @Post('hr/leave') admin(@Req() r: AuthRequest, @Body() d: AdminLeaveDto) {
    return this.service.administrative(r.principal, d);
  }
  @Post('hr/leave/:id/correct') correct(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AdminLeaveDto,
  ) {
    return this.service.administrative(r.principal, d, id);
  }
  @Post('hr/leave/adjustments') adjustment(@Req() r: AuthRequest, @Body() d: AdjustmentDto) {
    return this.service.adjustment(r.principal, d);
  }
}
@Module({ controllers: [LeaveController], providers: [LeaveService, LeaveBalanceService, LeaveApprovalResolver] })
export class LeaveModule {}

import { Body, Controller, Get, Header, Module, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { PERMISSIONS } from '@tms/contracts';
import { AuthRequest } from '../authorization/authorization';
import {
  AssignmentDto,
  DepartmentDto,
  EditDepartmentDto,
  EditEmployeeDto,
  EmployeeDto,
  EmploymentDto,
  PageDto,
  PermissionDto,
  ReasonDto,
  SuspendDto,
  TransferDto,
} from './dto';
import { OrganizationService } from './organization.service';
@Controller()
class OrganizationController {
  constructor(private readonly service: OrganizationService) {}
  @Get('directory/employees') directory(@Req() r: AuthRequest, @Query() q: PageDto) {
    return this.service.employees(r.principal, q);
  }
  @Get('organization') organization() {
    return this.service.hierarchy();
  }
  @Get('employees') employees(@Req() r: AuthRequest, @Query() q: PageDto) {
    return this.service.employees(r.principal, q, true);
  }
  @Post('employees') @Header('Cache-Control', 'no-store') create(@Req() r: AuthRequest, @Body() d: EmployeeDto) {
    return this.service.create(r.principal, d);
  }
  @Get('employees/:id') detail(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(r.principal, id);
  }
  @Patch('employees/:id') edit(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EditEmployeeDto,
  ) {
    return this.service.edit(r.principal, id, d);
  }
  @Get('departments') departments() {
    return this.service.departments();
  }
  @Post('departments') department(@Req() r: AuthRequest, @Body() d: DepartmentDto) {
    return this.service.createDepartment(r.principal, d);
  }
  @Patch('departments/:id') editDepartment(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EditDepartmentDto,
  ) {
    return this.service.editDepartment(r.principal, id, d);
  }
  @Post('departments/:id/activate') activate(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.departmentStatus(r.principal, id, true);
  }
  @Post('departments/:id/deactivate') deactivate(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.departmentStatus(r.principal, id, false);
  }
  @Post('departments/:id/director') director(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AssignmentDto,
  ) {
    return this.service.director(r.principal, id, d.employeeId, d.reason);
  }
  @Post('organization/senior-director') senior(@Req() r: AuthRequest, @Body() d: AssignmentDto) {
    return this.service.director(r.principal, null, d.employeeId, d.reason);
  }
  @Post('organization/hr-approver') hr(@Req() r: AuthRequest, @Body() d: AssignmentDto) {
    return this.service.hrApprover(r.principal, d.employeeId);
  }
  @Post('employees/:id/transfer') transfer(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: TransferDto,
  ) {
    return this.service.transfer(r.principal, id, d.departmentId, d.reason);
  }
  @Get('permissions') catalogue() {
    return PERMISSIONS;
  }
  @Get('employees/:id/permissions') permissions(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.permissions(r.principal, id);
  }
  @Post('employees/:id/permissions') grant(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PermissionDto,
  ) {
    return this.service.permission(r.principal, id, d);
  }
  @Post('employees/:id/permissions/revoke') revoke(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: PermissionDto,
  ) {
    return this.service.permission(r.principal, id, d, true);
  }
  @Get('employees/:id/employment-records') employment(@Req() r: AuthRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.employment(r.principal, id);
  }
  @Post('employees/:id/employment-records') employmentUpdate(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: EmploymentDto,
  ) {
    return this.service.updateEmployment(r.principal, id, d);
  }
  @Post('employees/:id/suspend') suspend(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: SuspendDto,
  ) {
    return this.service.status(r.principal, id, 'SUSPENDED', d.reason, d.suspendedUntil);
  }
  @Post('employees/:id/deactivate') inactive(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.service.status(r.principal, id, 'INACTIVE', d.reason);
  }
  @Post('employees/:id/reactivate') reactivate(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.service.status(r.principal, id, 'ACTIVE', d.reason);
  }
  @Post('employees/:id/terminate') terminate(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.service.status(r.principal, id, 'TERMINATED', d.reason);
  }
  @Post('employees/:id/reset-password') @Header('Cache-Control', 'no-store') reset(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _d: ReasonDto,
  ) {
    void _d;
    return this.service.reset(r.principal, id);
  }
}
@Module({ controllers: [OrganizationController], providers: [OrganizationService], exports: [OrganizationService] })
export class OrganizationModule {}

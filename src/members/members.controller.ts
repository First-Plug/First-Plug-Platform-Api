import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Request,
  Req,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { CreateMemberDto, UpdateMemberDto } from './dto';
import { ObjectId } from 'mongoose';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { JwtGuard } from 'src/auth/guard/jwt.guard';
import { CreateMemberArrayDto } from './dto/create-member-array.dto';
import { AddFullNameInterceptor } from './interceptors/add-full-name.interceptor';
import { HistoryService } from 'src/history/history.service';
import { ShipmentsService } from 'src/shipments/shipments.service';
import { AssignmentsService } from 'src/assignments/assignments.service';

@Controller('members')
@UseGuards(JwtGuard)
@UseInterceptors(AddFullNameInterceptor)
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly assignmentsService: AssignmentsService,
    private readonly historyService: HistoryService,
    private readonly shipmentsService: ShipmentsService,
  ) {}

  @Post()
  async create(@Body() createMemberDto: CreateMemberDto, @Req() req) {
    const { userId, tenantName } = req;

    return await this.membersService.create(
      createMemberDto,
      userId,
      tenantName,
    );
  }

  @Post('/bulkcreate')
  async bulkcreate(
    @Body()
    createMemberDto: CreateMemberArrayDto,
    @Req() req,
  ) {
    const { userId, tenantName } = req;
    return await this.membersService.bulkCreate(
      createMemberDto,
      userId,
      tenantName,
    );
  }

  @Post('/offboarding/:id')
  async offboarding(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() data: any,
    @Request() req: any,
  ) {
    const tenantName = req.user.tenantName;
    const { userId } = req;
    const ourOfficeEmail = req.user.email;
    console.log('offboarding → userId:', userId);

    return this.assignmentsService.offboardMember(
      id,
      data,
      userId,
      tenantName,
      ourOfficeEmail,
    );
  }

  @Get()
  findAll(@Req() req): Promise<any> {
    const { tenantName } = req.user;
    return this.membersService.findAll(tenantName);
  }

  @Get(':id')
  findById(@Param('id', ParseMongoIdPipe) id: ObjectId, @Req() req) {
    const { tenantName } = req;
    return this.membersService.findById(id, tenantName);
  }

  @Patch(':id')
  update(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateMemberDto: UpdateMemberDto,
    @Req() req,
  ) {
    const { userId, tenantName } = req;
    const ourOfficeEmail = req.user.email;
    return this.membersService.update(
      id,
      updateMemberDto,
      userId,
      tenantName,
      ourOfficeEmail,
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseMongoIdPipe) id: ObjectId, @Req() req) {
    const { userId, tenantName } = req;

    const memberDeleted = await this.membersService.softDeleteMember(
      id,
      tenantName,
    );

    await this.historyService.create({
      actionType: 'delete',
      itemType: 'members',
      userId: userId,
      changes: {
        oldData: memberDeleted,
        newData: null,
      },
    });

    return memberDeleted;
  }

  @Get('team/:teamId')
  async findMembersByTeam(@Param('teamId', ParseMongoIdPipe) teamId: ObjectId) {
    return await this.membersService.findMembersByTeam(teamId);
  }

  // already run this code, I leave it here for reference
  // @Get('update-dni-all-tenants')
  // async updateDniForAllTenants() {
  //   return await this.membersService.updateDniForAllTenants();
  // }
  // @Get('update-dni/:tenantName')
  // async updateDniForTenant(@Param('tenantName') tenantName: string) {
  //   return await this.membersService.updateDniForTenant(tenantName);
  // }
}

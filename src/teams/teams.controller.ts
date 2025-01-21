import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Delete,
  ParseArrayPipe,
  Req,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { ParseMongoIdPipe } from 'src/common/pipes/parse-mongo-id.pipe';
import { ObjectId, isValidObjectId, Types } from 'mongoose';
import { UpdateTeamDto } from './dto/update-team.dto';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Delete('bulk-delete')
  async bulkDelete(
    @Body('ids', new ParseArrayPipe({ items: String })) ids: string[],
    @Req() req,
  ) {
    const { userId } = req;
    const teamIds = ids.map((id) => new Types.ObjectId(id));
    return await this.teamsService.bulkDelete(teamIds, userId);
  }

  @Get()
  async findAll() {
    const teams = await this.teamsService.findAll();
    return teams;
  }

  @Get(':id')
  async findById(@Param('id', ParseMongoIdPipe) id: ObjectId) {
    const teams = await this.teamsService.findById(id);
    return teams;
  }

  @Post()
  async create(@Body() createTeamDto: CreateTeamDto, @Req() req) {
    const { userId } = req;
    const teams = await this.teamsService.create(createTeamDto, userId);
    return teams;
  }

  @Patch(':id')
  async update(
    @Param('id', ParseMongoIdPipe) id: ObjectId,
    @Body() updateTeamDto: UpdateTeamDto,
    @Req() req,
  ) {
    const { userId } = req;
    const teams = await this.teamsService.update(id, updateTeamDto, userId);
    return teams;
  }

  @Put(':teamId/members/:memberId')
  async associateTeamToMember(
    @Param('teamId', ParseMongoIdPipe) teamId: Types.ObjectId,
    @Param('memberId', ParseMongoIdPipe) memberId: Types.ObjectId,
    @Req() req,
  ) {
    const { userId } = req;
    const member = await this.teamsService.associateTeamToMember(
      teamId,
      memberId,
      userId,
    );
    return member;
  }

  @Put(':memberId/change-member/:teamId')
  async changeTeamForMember(
    @Param('memberId', ParseMongoIdPipe) memberId: Types.ObjectId,
    @Param('teamId', ParseMongoIdPipe) teamId: Types.ObjectId,
  ) {
    const member = await this.teamsService.changeTeamForMember(
      teamId,
      memberId,
    );
    return member;
  }

  @Put('change-members/:teamId')
  async changeTeamForMembers(
    @Param('teamId', ParseMongoIdPipe) teamId: Types.ObjectId,
    @Body('membersIds') membersIds: string[],
  ) {
    if (!membersIds) {
      throw new BadRequestException('No member IDs provided');
    }

    const memberIds = membersIds.map((id) => {
      if (!isValidObjectId(id)) {
        throw new BadRequestException(`Invalid member ID: ${id}`);
      }
      return new Types.ObjectId(id);
    });

    return await this.teamsService.changeTeamForMembers(teamId, memberIds);
  }

  @Put(':memberId/unassign-member')
  async unassignMemberFromTeam(
    @Param('memberId', ParseMongoIdPipe) memberId: Types.ObjectId,
    @Body('teamId') teamId: Types.ObjectId,
    @Req() req,
  ) {
    const { userId } = req;
    const member = await this.teamsService.unassignMemberFromTeam(
      memberId,
      teamId,
      userId,
    );
    return member;
  }

  @Delete(':id')
  async delete(@Param('id', ParseMongoIdPipe) id: Types.ObjectId, @Req() req) {
    const { userId } = req;
    return await this.teamsService.delete(id, userId);
  }
}

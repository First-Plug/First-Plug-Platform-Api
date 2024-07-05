import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { ClientSession, Model, ObjectId, Types } from 'mongoose';
import { Team } from './schemas/team.schema';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Member } from '../members/schemas/member.schema';

@Injectable()
export class TeamsService {
  constructor(
    @Inject('TEAM_MODEL') private teamRepository: Model<Team>,
    @Inject('MEMBER_MODEL') private memberRepository: Model<Member>,
  ) {}

  private normalizeTeamName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private availableColors: string[] = [
    '#FFE8E8',
    '#D6E1FF',
    '#F2E8FF',
    '#D2FAEE',
    '#FFF2D1',
    '#E8F1FF',
    '#FFEBE8',
    '#E8FFF2',
    '#FFF8E8',
    '#F2D1FF',
    '#4260F5',
    '#E8FFD6',
    '#FFD1F2',
    '#D1FFE8',
    '#D6FFD6',
    '#FFD6D6',
    '#E8D1FF',
    '#D1F2FF',
    '#FFF2E8',
    '#FFE8D1',
    '#D1FFE1',
    '#F2D1E8',
    '#D6F2FF',
    '#FFF2FF',
    '#E8D1D1',
  ];

  private inUseColors: string[] = [];

  private async getUsedColors(): Promise<string[]> {
    const teams = await this.teamRepository.find({}, { color: 1, _id: 0 });
    return teams.map((team) => team.color);
  }

  private async assignColor(): Promise<string> {
    try {
      if (this.availableColors.length === 0 && this.inUseColors.length === 0) {
        this.availableColors = [
          '#FFE8E8',
          '#D6E1FF',
          '#F2E8FF',
          '#D2FAEE',
          '#FFF2D1',
          '#E8F1FF',
          '#FFEBE8',
          '#E8FFF2',
          '#FFF8E8',
          '#F2D1FF',
          '#4260F5',
          '#E8FFD6',
          '#FFD1F2',
          '#D1FFE8',
          '#D6FFD6',
          '#FFD6D6',
          '#E8D1FF',
          '#D1F2FF',
          '#FFF2E8',
          '#FFE8D1',
          '#D1FFE1',
          '#F2D1E8',
          '#D6F2FF',
          '#FFF2FF',
          '#E8D1D1',
        ];
        this.inUseColors = await this.getUsedColors();
        this.availableColors = this.availableColors.filter(
          (color) => !this.inUseColors.includes(color),
        );
      }

      if (this.availableColors.length === 0) {
        this.availableColors = [...this.inUseColors];
        this.inUseColors = [];
      }
      const color = this.availableColors.shift();

      if (!color) {
        throw new InternalServerErrorException('No available colors to assign');
      }
      this.inUseColors.push(color);

      console.log('Available Colors:', this.availableColors);
      console.log('In Use Colors:', this.inUseColors);

      return color;
    } catch (error) {
      console.error('Error in assignColor:', error);
      throw error;
    }
  }

  async unassignMemberFromTeam(
    memberId: Types.ObjectId,
    teamId: Types.ObjectId,
  ) {
    try {
      const member = await this.memberRepository.findById(memberId);
      if (!member) {
        throw new BadRequestException('Member not found');
      }
      if (!member.team || member.team.toString() !== teamId.toString()) {
        throw new BadRequestException(
          'Member is not assigned to the provided team',
        );
      }
      member.team = undefined;
      await member.save();
      return member;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async create(createTeamDto: CreateTeamDto) {
    try {
      const normalizedTeamName = this.normalizeTeamName(createTeamDto.name);
      let team = await this.teamRepository.findOne({
        name: normalizedTeamName,
      });

      if (team) {
        return team;
      }

      let color;
      do {
        color = await this.assignColor();
      } while (
        (await this.teamRepository.findOne({ color })) &&
        this.availableColors.length > 0
      );

      team = new this.teamRepository({
        ...createTeamDto,
        name: normalizedTeamName,
        color,
      });
      return await team.save();
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async bulkCreate(createTeamDtos: CreateTeamDto[], session: ClientSession) {
    try {
      const normalizedTeams = createTeamDtos.map((team) => ({
        ...team,
        name: this.normalizeTeamName(team.name),
      }));

      const existingTeams = await this.teamRepository.find({
        name: { $in: normalizedTeams.map((team) => team.name) },
      });

      const existingTeamNames = existingTeams.map((team) => team.name);

      const teamsToCreate = normalizedTeams.filter(
        (team) => !existingTeamNames.includes(team.name),
      );

      const teamsWithColors = await Promise.all(
        teamsToCreate.map(async (team) => ({
          ...team,
          color: await this.assignColor(),
        })),
      );

      const createdTeams = await this.teamRepository.insertMany(
        teamsWithColors,
        { session },
      );

      return createdTeams;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async associateTeamToMember(
    TeamId: Types.ObjectId,
    memberId: Types.ObjectId,
  ) {
    try {
      const member = await this.memberRepository.findById(memberId);
      if (!member) {
        throw new BadRequestException('Member not found');
      }
      member.team = TeamId;
      await member.save();
      return member;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async changeTeamForMember(memberId: Types.ObjectId, TeamId: Types.ObjectId) {
    try {
      const member = await this.memberRepository.findById(memberId);
      if (!member) {
        throw new BadRequestException('Member not found');
      }
      member.team = TeamId;
      await member.save();
      return member;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async changeTeamForMembers(
    teamId: Types.ObjectId,
    memberIds: Types.ObjectId[],
  ) {
    try {
      const members = await this.memberRepository.find({
        _id: { $in: memberIds },
      });

      if (!members.length) {
        throw new BadRequestException('Members not found');
      }
      for (const member of members) {
        member.team = teamId;
        await member.save();
      }
      return members;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async update(id: ObjectId, updateTeamDto: UpdateTeamDto) {
    try {
      const normalizedTeamName = this.normalizeTeamName(updateTeamDto.name);
      const existingTeam = await this.teamRepository.findOne({
        name: normalizedTeamName,
      });

      if (existingTeam && existingTeam._id.toString() !== id.toString()) {
        throw new BadRequestException(
          'There is already another team with that name',
        );
      }

      const team = await this.teamRepository.findByIdAndUpdate(
        id,
        { ...updateTeamDto, name: normalizedTeamName },
        {
          new: true,
        },
      );

      return team;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findAll() {
    const teams = this.teamRepository.find();
    return teams;
  }

  async findById(id: ObjectId) {
    const team = this.teamRepository.findById(id);
    return team;
  }

  async findByName(name: string) {
    const team = this.teamRepository.findOne({ name });
    return team;
  }

  async delete(id: Types.ObjectId) {
    try {
      const members = await this.memberRepository.find({ team: id });
      if (members.length > 0) {
        throw new BadRequestException(
          'Cannot delete team. There are members associated with it',
        );
      }
      const result = await this.teamRepository.findByIdAndDelete(id);
      if (!result) {
        throw new BadRequestException('Team not found');
      }
      return result;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async unassignTeamsFromMembers(teamIds: Types.ObjectId[]) {
    const objectIds = teamIds.map((id) => new Types.ObjectId(id));

    try {
      const result = await this.memberRepository.updateMany(
        { team: { $in: objectIds } },
        { $set: { team: '' } },
        { multi: true },
      );
      return result;
    } catch (error) {
      throw new InternalServerErrorException(
        'Unexpected error during unassigning teams from members',
      );
    }
  }

  async bulkDelete(ids: Types.ObjectId[]) {
    try {
      await this.unassignTeamsFromMembers(ids);
      const result = await this.teamRepository.deleteMany({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      });
      return result;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  private handleDBExceptions(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(
        'There is already another team with that name',
      );
    }
    throw new InternalServerErrorException(
      'Unexcepted error, check server log',
    );
  }
}

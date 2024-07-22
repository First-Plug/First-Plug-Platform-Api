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
      .replace(/(?:^|\s|["'([{])\S/g, (char) => char.toUpperCase());
  }

  private availableColors: string[] = [
    '#dcebe8',
    '#cfddf6',
    '#fbe8eb',
    '#eae09f',
    '#f6d5da',
    '#c5e0f2',
    '#e5e4f0',
    '#dfdcf8',
    '#eff5d2',
    '#e5f0f9',
    '#f7d7f7',
    '#fcf6f4',
    '#e5dcf8',
    '#f5efd0',
    '#eae29e',
    '#f1fcf4',
    '#d6f7f7',
    '#faeae6',
    '#ecdfe0',
    '#e9ebdc',
    '#f8ebdc',
    '#eeecfb',
    '#fae6e6',
    '#f6d5d9',
    '#f6f0cb',
    '#d2f5eb',
    '#ece0ee',
    '#c0f2cf',
    '#fcf7f0',
    '#ebdddd',
  ];

  private usedColors: string[] = [];

  private async getUsedColors(): Promise<string[]> {
    const teams = await this.teamRepository.find({}, { color: 1, _id: 0 });
    return teams.map((team) => team.color);
  }

  private async assignColor(): Promise<string> {
    const usedColors = await this.getUsedColors();
    const availableColors = this.availableColors.filter(
      (color) => !usedColors.includes(color),
    );

    if (availableColors.length === 0) {
      return this.availableColors[
        Math.floor(Math.random() * this.availableColors.length)
      ];
    }

    const color =
      availableColors[Math.floor(Math.random() * availableColors.length)];

    this.usedColors.push(color);
    return color;
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

      const color = await this.assignColor();

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

      const usedColors = await this.getUsedColors();

      const teamsWithColors = await Promise.all(
        teamsToCreate.map(async (team) => {
          let color;
          do {
            color = await this.assignColor();
          } while (usedColors.includes(color));
          usedColors.push(color); // Add the assigned color to usedColors
          return { ...team, color };
        }),
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

import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import { ClientSession, Model, ObjectId, Types } from 'mongoose';
import { Team } from './schemas/team.schema';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Member } from '../members/schemas/member.schema';
import { HistoryService } from 'src/history/history.service';
import { emptyTeam } from './utils/empty-team';
import { flattenTeam } from './utils/flatten-team';

@Injectable()
export class TeamsService {
  constructor(
    @Inject('TEAM_MODEL') private teamRepository: Model<Team>,
    @Inject('MEMBER_MODEL') private memberRepository: Model<Member>,
    private readonly historyService: HistoryService,
  ) {}

  private normalizeTeamName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/(?:^|\s|["'([{])\p{L}/gu, (char) => char.toUpperCase());
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
    userId: string,
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

      await this.historyService.create({
        actionType: 'unassign',
        itemType: 'teams',
        userId: userId,
        changes: {
          oldData: member,
          newData: { ...member, team: undefined },
        },
      });

      member.team = undefined;
      await member.save();
      return member;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async create(createTeamDto: CreateTeamDto, userId: string) {
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

      await this.historyService.create({
        actionType: 'create',
        itemType: 'teams',
        userId: userId,
        changes: {
          oldData: emptyTeam,
          newData: { _id: team.id, name: team.name, color: team.color },
        },
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
    userId: string,
  ) {
    try {
      const member = await this.memberRepository.findById(memberId);
      if (!member) {
        throw new BadRequestException('Member not found');
      }

      const currentTeam = member.team
        ? await this.teamRepository.findById(member.team)
        : null;

      const newTeam = await this.teamRepository.findById(TeamId);
      if (!newTeam) {
        throw new BadRequestException('New team not found');
      }

      const actionType = currentTeam ? 'reassign' : 'assign';

      await this.historyService.create({
        actionType: actionType,
        itemType: 'teams',
        userId: userId,
        changes: {
          oldData: {
            ...member.toObject(),
            team: currentTeam,
          },
          newData: {
            ...member.toObject(),
            team: newTeam,
          },
        },
      });

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

  async update(id: ObjectId, updateTeamDto: UpdateTeamDto, userId: string) {
    try {
      const normalizedTeamName = this.normalizeTeamName(updateTeamDto.name);

      const existingTeam = await this.teamRepository.findById(id);
      if (!existingTeam) {
        throw new NotFoundException('Team not found');
      }

      const teamWithSameName = await this.teamRepository.findOne({
        name: normalizedTeamName,
      });
      if (
        teamWithSameName &&
        teamWithSameName._id.toString() !== id.toString()
      ) {
        throw new BadRequestException(
          'There is already another team with that name',
        );
      }

      const payloadOldData = {
        _id: existingTeam._id.toString(),
        name: existingTeam.name,
        color: existingTeam.color,
      };

      const team = await this.teamRepository.findByIdAndUpdate(
        id,
        { ...updateTeamDto, name: normalizedTeamName },
        { new: true },
      );

      if (!team) {
        throw new NotFoundException('Failed to update team');
      }

      const payloadTeam = {
        _id: team._id.toString(),
        name: team.name,
        color: team.color,
      };

      await this.historyService.create({
        actionType: 'update',
        itemType: 'teams',
        userId: userId,
        changes: {
          oldData: payloadOldData,
          newData: payloadTeam,
        },
      });

      return team;
    } catch (error) {
      console.log(error);
      this.handleDBExceptions(error);
    }
  }

  async findAll() {
    const teams = this.teamRepository
      .find()
      .collation({ locale: 'es', strength: 1 })
      .sort({ name: 1 });
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

  async delete(id: Types.ObjectId, userId: string) {
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

      await this.historyService.create({
        actionType: 'delete',
        itemType: 'teams',
        userId: userId,
        changes: {
          oldData: flattenTeam(result),
          newData: emptyTeam,
        },
      });

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

  async bulkDelete(ids: Types.ObjectId[], userId: string) {
    try {
      const teams = await this.teamRepository.find({ _id: { $in: ids } });

      await this.unassignTeamsFromMembers(ids);
      const result = await this.teamRepository.deleteMany({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      });

      const historyData = {
        oldData: teams.map((team) => ({
          id: team.id,
          name: team.name,
          color: team.color,
        })),
        newData: null,
      };

      await this.historyService.create({
        actionType: 'bulk-delete',
        itemType: 'teams',
        userId: userId,
        changes: historyData,
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

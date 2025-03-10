import { Inject, Injectable } from '@nestjs/common';
import mongoose, { Model } from 'mongoose';
import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './schemas/history.schema';
import { EnvConfiguration } from 'src/config';
import { TenantSchema } from 'src/tenants/schemas/tenant.schema';
import { Team } from 'src/teams/schemas/team.schema';

@Injectable()
export class HistoryService {
  private tenantConnection: mongoose.Connection | null;

  constructor(
    @Inject('HISTORY_MODEL')
    private readonly historyRepository: Model<History>,
    @Inject('TEAM_MODEL') private teamRepository: Model<Team>,
  ) {}

  async create(createHistoryDto: CreateHistoryDto) {
    return this.historyRepository.create(createHistoryDto);
  }

  async findAll(page: number, size: number, startDate?: Date, endDate?: Date) {
    const skip = (page - 1) * size;

    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      dateFilter.createdAt = { $gte: startDate };
    } else if (endDate) {
      dateFilter.createdAt = { $lte: endDate };
    }

    const [data, totalCount] = await Promise.all([
      this.historyRepository
        .find(dateFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .exec(),
      this.historyRepository.countDocuments(dateFilter).exec(),
    ]);

    const userIds = data.map((record) => record.userId);

    const tenants = await this.getTenantsByUserIds(userIds);

    const updatedData = await Promise.all(
      data.map(async (record) => {
        const tenant = tenants.find(
          (tenant) => tenant._id.toString() === record.userId.toString(),
        );
        if (tenant) {
          record.userId = tenant.email;
        }

        if (
          (record.itemType === 'members' && record.actionType === 'update') ||
          (record.itemType === 'teams' &&
            (record.actionType === 'reassign' ||
              record.actionType === 'assign' ||
              record.actionType === 'unassign' ||
              record.actionType === 'reassign'))
        ) {
          if (
            record.changes?.oldData?.team &&
            typeof record.changes.oldData.team === 'string'
          ) {
            const oldTeam = await this.teamRepository
              .findById(record.changes.oldData.team)
              .exec();
            if (oldTeam) {
              record.changes.oldData.team = oldTeam;
            }
          }

          if (
            record.changes?.newData?.team &&
            typeof record.changes.newData.team === 'string'
          ) {
            const newTeam = await this.teamRepository
              .findById(record.changes.newData.team)
              .exec();
            if (newTeam) {
              record.changes.newData.team = newTeam;
            }
          }
        }

        return record;
      }),
    );

    return {
      data: updatedData,
      totalCount,
      totalPages: Math.ceil(totalCount / size),
    };
  }

  async getTenantsByUserIds(userIds: string[]) {
    try {
      this.tenantConnection = mongoose.createConnection(
        EnvConfiguration().database.connectionString!,
      );
      const TenantModel = this.tenantConnection.model('Tenant', TenantSchema);
      const tenants = await TenantModel.find({ _id: { $in: userIds } }).exec();

      await this.tenantConnection.close();

      return tenants;
    } catch (error) {
      console.error('Error al obtener los tenants:', error);
      throw new Error('Error al obtener los tenants');
    } finally {
      if (this.tenantConnection!.readyState !== 0) {
        await this.tenantConnection!.close();
      }
    }
  }
}

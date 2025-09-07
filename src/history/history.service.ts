import { Inject, Injectable, Optional } from '@nestjs/common';
import { Model } from 'mongoose';
import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './schemas/history.schema';
import { Team } from 'src/teams/schemas/team.schema';
import { TenantUserAdapterService } from 'src/common/services/tenant-user-adapter.service';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class HistoryService {
  constructor(
    @Inject('HISTORY_MODEL')
    private readonly historyRepository: Model<History>,
    @Inject('TEAM_MODEL') private teamRepository: Model<Team>,
    @Optional() private readonly tenantUserAdapter?: TenantUserAdapterService,
  ) {}

  async create(createHistoryDto: CreateHistoryDto) {
    if (
      createHistoryDto.itemType === 'assets' &&
      createHistoryDto.actionType === 'offboarding'
    ) {
      console.log('🟡 Skipping offboarding history creation');
      return null;
    }
    return this.historyRepository.create(createHistoryDto);
  }

  async findLatest() {
    const data = await this.historyRepository
      .find()
      .sort({ createdAt: -1 })
      .limit(3)
      .exec();

    const userIds = data.map((record) => record.userId);

    const tenants = await this.getTenantsByUserIds(userIds);

    return await Promise.all(
      data.map(async (record) => {
        const tenant = tenants.find(
          (tenant) => tenant._id.toString() === record.userId.toString(),
        );
        if (tenant) {
          record.userId = tenant.email;
        }
        return record;
      }),
    );
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
          (record.itemType === 'members' &&
            ['update', 'create', 'delete', 'bulk-create'].includes(
              record.actionType,
            )) ||
          (record.itemType === 'teams' &&
            ['reassign', 'assign', 'unassign'].includes(record.actionType))
        ) {
          if (
            record.itemType === 'members' &&
            record.actionType === 'bulk-create'
          ) {
            if (Array.isArray(record.changes?.newData)) {
              for (const member of record.changes.newData) {
                if (member.team && typeof member.team === 'string') {
                  const newTeam = await this.teamRepository
                    .findById(member.team)
                    .exec();
                  if (newTeam) {
                    member.team = newTeam;
                  }
                }
              }
            }
          } else {
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
      const validUserIds = userIds.filter((id) => isValidObjectId(id));

      // Usar el adaptador para obtener usuarios/tenants con la estructura esperada
      if (!this.tenantUserAdapter) {
        console.warn('TenantUserAdapter not available, returning empty array');
        return [];
      }

      const tenants =
        await this.tenantUserAdapter.findTenantsByIds(validUserIds);

      return tenants;
    } catch (error) {
      console.error('Error al obtener los tenants:', error);
      throw new Error('Error al obtener los tenants');
    }
  }
}

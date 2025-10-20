import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './schemas/history.schema';
import { Team } from 'src/teams/schemas/team.schema';
import { UsersService } from 'src/users/users.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { isValidObjectId } from 'mongoose';

@Injectable()
export class HistoryService {
  constructor(
    @Inject('HISTORY_MODEL')
    private readonly historyRepository: Model<History>,
    @Inject('TEAM_MODEL') private teamRepository: Model<Team>,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
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
        // Convertir el documento de Mongoose a objeto plano para poder modificarlo
        const recordObj = record.toObject();

        const tenant = tenants.find(
          (tenant) =>
            tenant && tenant._id.toString() === record.userId.toString(),
        );
        if (tenant) {
          recordObj.userId = tenant.email;
        }
        return recordObj;
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
        // Convertir el documento de Mongoose a objeto plano para poder modificarlo
        const recordObj = record.toObject();

        const tenant = tenants.find(
          (tenant) =>
            tenant && tenant._id.toString() === record.userId.toString(),
        );
        if (tenant) {
          recordObj.userId = tenant.email;
        }
        if (
          (recordObj.itemType === 'members' &&
            ['update', 'create', 'delete', 'bulk-create'].includes(
              recordObj.actionType,
            )) ||
          (recordObj.itemType === 'teams' &&
            ['reassign', 'assign', 'unassign'].includes(recordObj.actionType))
        ) {
          if (
            recordObj.itemType === 'members' &&
            recordObj.actionType === 'bulk-create'
          ) {
            if (Array.isArray(recordObj.changes?.newData)) {
              for (const member of recordObj.changes.newData) {
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
              recordObj.changes?.oldData?.team &&
              typeof recordObj.changes.oldData.team === 'string'
            ) {
              const oldTeam = await this.teamRepository
                .findById(recordObj.changes.oldData.team)
                .exec();
              if (oldTeam) {
                recordObj.changes.oldData.team = oldTeam;
              }
            }

            if (
              recordObj.changes?.newData?.team &&
              typeof recordObj.changes.newData.team === 'string'
            ) {
              const newTeam = await this.teamRepository
                .findById(recordObj.changes.newData.team)
                .exec();
              if (newTeam) {
                recordObj.changes.newData.team = newTeam;
              }
            }
          }
        }

        return recordObj;
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

      // Obtener usuarios directamente para evitar dependencias circulares
      const users = await Promise.all(
        validUserIds.map(async (id) => {
          try {
            const user = await this.usersService.findById(id);
            if (user) {
              return {
                _id: user._id,
                email: user.email,
              };
            }

            // Si no es un usuario, intentar buscar como tenant viejo
            const tenant = await this.tenantsService.getTenantById(id);
            if (tenant && (tenant as any).email) {
              return {
                _id: tenant._id,
                email: (tenant as any).email,
              };
            }

            return null;
          } catch (error) {
            console.warn(
              `Error obteniendo usuario/tenant ${id}:`,
              error.message,
            );
            return null;
          }
        }),
      );

      return users.filter((user) => user !== null);
    } catch (error) {
      console.error('Error al obtener los usuarios:', error);
      throw new Error('Error al obtener los usuarios');
    }
  }
}

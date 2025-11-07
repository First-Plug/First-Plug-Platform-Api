import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './schemas/history.schema';
import { Team } from 'src/teams/schemas/team.schema';
import { UsersService } from 'src/users/users.service';
import { TenantsService } from 'src/tenants/tenants.service';
import { isValidObjectId } from 'mongoose';
import { LegacyRecordDetector } from './helpers/legacy-detector.helper';
import { AssetHistoryCompatibility } from './helpers/asset-compatibility.helper';
import { SafeTeamPopulation } from './helpers/safe-team-population.helper';

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

        // 🔧 COMPATIBILITY: Normalizar assets legacy para frontend
        const finalRecord =
          recordObj.itemType === 'assets'
            ? AssetHistoryCompatibility.normalizeAssetRecordForFrontend(
                recordObj,
              )
            : recordObj;

        return finalRecord;
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

        // 🌍 TRANSFORM: Reemplazar "FP warehouse" con country code del warehouse
        // Solo aplicar transformaciones a registros nuevos, no a legacy
        if (!LegacyRecordDetector.isLegacyRecord(recordObj)) {
          recordObj.changes = await this.transformWarehouseLocations(
            recordObj.changes,
          );
        }
        // 👥 POPULATE: Poblar teams de forma segura usando helper
        await SafeTeamPopulation.populateTeamsInHistoryRecord(
          this.teamRepository,
          recordObj,
        );

        // 🔧 COMPATIBILITY: Normalizar assets legacy para frontend
        const finalRecord =
          recordObj.itemType === 'assets'
            ? AssetHistoryCompatibility.normalizeAssetRecordForFrontend(
                recordObj,
              )
            : recordObj;

        return finalRecord;
      }),
    );

    return {
      data: updatedData,
      totalCount,
      totalPages: Math.ceil(totalCount / size),
    };
  }

  /**
   * 🌍 Helper para transformar "FP warehouse" locations a country codes
   * ⚠️  SOLO se aplica a registros nuevos, no a legacy (para mantener compatibilidad)
   */
  private async transformWarehouseLocations(changes: any): Promise<any> {
    if (!changes) return changes;

    const transformedChanges = { ...changes };

    // Transformar oldData si existe
    if (changes.oldData) {
      transformedChanges.oldData = await this.transformLocationInData(
        changes.oldData,
      );
    }

    // Transformar newData si existe
    if (changes.newData) {
      transformedChanges.newData = await this.transformLocationInData(
        changes.newData,
      );
    }

    return transformedChanges;
  }

  /**
   * 🌍 Helper para transformar location en un objeto de datos
   */
  private async transformLocationInData(data: any): Promise<any> {
    if (!data) return data;

    // Si es un array, transformar cada elemento
    if (Array.isArray(data)) {
      return Promise.all(
        data.map((item) => this.transformLocationInData(item)),
      );
    }

    // Si es un objeto, verificar si tiene location === "FP warehouse"
    if (typeof data === 'object' && data.location === 'FP warehouse') {
      const transformedData = { ...data };

      // Si tiene fpWarehouse.warehouseCountryCode, agregarlo como campo separado
      if (data.fpWarehouse?.warehouseCountryCode) {
        // ✅ AGREGAR campo warehouseCountryCode, NO reemplazar location
        transformedData.warehouseCountryCode =
          data.fpWarehouse.warehouseCountryCode;
      }
      // Si no tiene fpWarehouse pero tiene _id, buscar el producto actual
      else if (data._id) {
        // TODO: Implementar búsqueda del producto si es necesario
        // Por ahora, mantener "FP warehouse" sin country code
      }

      return transformedData;
    }

    return data;
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

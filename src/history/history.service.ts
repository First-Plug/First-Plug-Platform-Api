import { Inject, Injectable } from '@nestjs/common';
import mongoose, { Model } from 'mongoose';
import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './schemas/history.schema';
import { EnvConfiguration } from 'src/config';
import { TenantSchema } from 'src/tenants/schemas/tenant.schema';

@Injectable()
export class HistoryService {
  private tenantConnection: mongoose.Connection | null;

  constructor(
    @Inject('HISTORY_MODEL')
    private readonly historyRepository: Model<History>,
  ) {}

  async create(createHistoryDto: CreateHistoryDto) {
    return this.historyRepository.create(createHistoryDto);
  }

  async findAll(page: number, size: number) {
    const skip = (page - 1) * size;
    const [data, totalCount] = await Promise.all([
      this.historyRepository
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(size)
        .exec(),
      this.historyRepository.countDocuments().exec(),
    ]);

    const userIds = data.map((record) => record.userId);

    const tenants = await this.getTenantsByUserIds(userIds);

    const updatedData = data.map((record) => {
      const tenant = tenants.find(
        (tenant) => tenant._id.toString() === record.userId.toString(),
      );
      if (tenant) {
        record.userId = tenant.email;
      }
      return record;
    });

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

import { Inject, Injectable } from '@nestjs/common';
import mongoose, { Model } from 'mongoose';
import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './schemas/history.schema';
import { EnvConfiguration } from 'src/config';
import { TenantSchema } from 'src/tenants/schemas/tenant.schema';

@Injectable()
export class HistoryService {
  private tenantConnection: mongoose.Connection;

  constructor(
    @Inject('HISTORY_MODEL')
    private readonly historyRepository: Model<History>,
  ) {
    this.tenantConnection = mongoose.createConnection(
      EnvConfiguration().database.connectionString!,
    );
  }

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
    const TenantModel = this.tenantConnection.model('Tenant', TenantSchema);
    const tenants = await TenantModel.find({ _id: { $in: userIds } }).exec();
    return tenants;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';

import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './entities/history.schema';

@Injectable()
export class HistoryService {
  constructor(
    @Inject('HISTORY_MODEL')
    private readonly historyRepository: Model<History>,
  ) {}

  async create(createHistoryDto: CreateHistoryDto) {
    const {
      changes: { newData, oldData },
    } = createHistoryDto;

    // Check that newData has the same keys as oldData
    const oldDataKeys = Object.keys(oldData);
    const newDataKeys = Object.keys(newData);

    if (oldDataKeys.length !== newDataKeys.length) {
      throw new Error('newData must have exactly the same keys as oldData');
    }

    for (const key of oldDataKeys) {
      if (!newData.hasOwnProperty(key)) {
        throw new Error(`Key '${key}' is missing in newData`);
      }
    }

    return this.historyRepository.create(createHistoryDto);
  }
}

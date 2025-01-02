import { Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';

import { CreateHistoryDto } from './dto/create-history.dto';
import { History } from './schemas/history.schema';

@Injectable()
export class HistoryService {
  constructor(
    @Inject('HISTORY_MODEL')
    private readonly historyRepository: Model<History>,
  ) {}

  async create(createHistoryDto: CreateHistoryDto) {
    return this.historyRepository.create(createHistoryDto);
  }
}

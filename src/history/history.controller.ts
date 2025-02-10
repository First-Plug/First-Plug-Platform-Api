import { Controller, Post, Body, UseGuards, Query, Get } from '@nestjs/common';
import { HistoryService } from './history.service';
import { CreateHistoryDto } from './dto/create-history.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@Controller('history')
@UseGuards(JwtGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async paginatedHistory(
    @Query('page') page: string = '1',
    @Query('size') size: string = '10',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const pageSize = parseInt(size, 10) || 10;

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.historyService.findAll(pageNumber, pageSize, start, end);
  }

  @Post()
  async create(@Body() createHistoryDto: CreateHistoryDto) {
    return await this.historyService.create(createHistoryDto);
  }
}

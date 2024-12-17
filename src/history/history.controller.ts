import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { CreateHistoryDto } from './dto/create-history.dto';
import { JwtGuard } from 'src/auth/guard/jwt.guard';

@Controller('history')
@UseGuards(JwtGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Post()
  create(@Body() createHistoryDto: CreateHistoryDto) {
    return this.historyService.create(createHistoryDto);
  }
}

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);

  constructor() // acá irán los inyectables que necesite, como repositories o servicios auxiliares
  {}

  // lugar para ir moviendo métodos transversales
}

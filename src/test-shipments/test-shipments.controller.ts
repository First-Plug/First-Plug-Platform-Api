import { Controller, Patch, Query, Param } from '@nestjs/common';
import { TestShipmentsService } from './test-shipments.service';

@Controller('test-shipments')
export class TestShipmentsController {
  constructor(private readonly testShipmentsService: TestShipmentsService) {}

  @Patch(':id/cancel')
  async cancelTest(@Param('id') id: string, @Query('tenant') tenant: string) {
    return await this.testShipmentsService.cancelShipmentAndUpdateProductStatus(
      id,
      tenant,
    );
  }
  @Patch('collections')
  async getCollections(@Query('tenant') tenant: string) {
    return await this.testShipmentsService.listCollections(tenant);
  }
}

import { Module } from '@nestjs/common';
import { TenantsModule } from 'src/tenants/tenants.module';
import { TestShipmentsController } from 'src/test-shipments/test-shipments.controller';
import { TestShipmentsService } from 'src/test-shipments/test-shipments.service';

@Module({
  imports: [TenantsModule],
  controllers: [TestShipmentsController],
  providers: [TestShipmentsService],
})
export class TestShipmentsModule {}

import { Test, TestingModule } from '@nestjs/testing';
import { TestShipmentsService } from './test-shipments.service';

describe('TestShipmentsService', () => {
  let service: TestShipmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestShipmentsService],
    }).compile();

    service = module.get<TestShipmentsService>(TestShipmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

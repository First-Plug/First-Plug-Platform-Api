import { Test, TestingModule } from '@nestjs/testing';
import { TestShipmentsController } from './test-shipments.controller';

describe('TestShipmentsController', () => {
  let controller: TestShipmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestShipmentsController],
    }).compile();

    controller = module.get<TestShipmentsController>(TestShipmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

import { validate } from 'class-validator';
import { CreateTenantDto } from './create-tenant.dto';

describe('CreateTenantDto', () => {
  describe('name validation', () => {
    it('should allow valid company names', async () => {
      const dto = new CreateTenantDto();
      dto.name = 'Test Company';
      dto.tenantName = 'test-company';

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors).toHaveLength(0);
    });

    it('should allow undefined name (optional)', async () => {
      const dto = new CreateTenantDto();
      dto.tenantName = 'test-company';
      // name is undefined by default

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors).toHaveLength(0);
    });

    it('should allow empty string for name', async () => {
      const dto = new CreateTenantDto();
      dto.name = '';
      dto.tenantName = 'test-company';

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors).toHaveLength(0);
    });

    it('should reject non-string values for name', async () => {
      const dto = new CreateTenantDto();
      (dto as any).name = 123; // Invalid type
      dto.tenantName = 'test-company';

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors.length).toBeGreaterThan(0);
      expect(nameErrors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('tenantName validation', () => {
    it('should require tenantName', async () => {
      const dto = new CreateTenantDto();
      dto.name = 'Test Company';
      // tenantName is missing

      const errors = await validate(dto);
      const tenantNameErrors = errors.filter(error => error.property === 'tenantName');
      
      expect(tenantNameErrors.length).toBeGreaterThan(0);
    });

    it('should allow valid tenantName', async () => {
      const dto = new CreateTenantDto();
      dto.name = 'Test Company';
      dto.tenantName = 'test-company';

      const errors = await validate(dto);
      const tenantNameErrors = errors.filter(error => error.property === 'tenantName');
      
      expect(tenantNameErrors).toHaveLength(0);
    });
  });

  describe('image validation', () => {
    it('should allow optional image', async () => {
      const dto = new CreateTenantDto();
      dto.name = 'Test Company';
      dto.tenantName = 'test-company';
      dto.image = 'https://example.com/image.jpg';

      const errors = await validate(dto);
      const imageErrors = errors.filter(error => error.property === 'image');
      
      expect(imageErrors).toHaveLength(0);
    });

    it('should allow undefined image', async () => {
      const dto = new CreateTenantDto();
      dto.name = 'Test Company';
      dto.tenantName = 'test-company';
      // image is undefined

      const errors = await validate(dto);
      const imageErrors = errors.filter(error => error.property === 'image');
      
      expect(imageErrors).toHaveLength(0);
    });
  });
});

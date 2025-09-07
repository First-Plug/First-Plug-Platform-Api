import { validate } from 'class-validator';
import { UpdateCompanyNameDto } from './update-company-name.dto';

describe('UpdateCompanyNameDto', () => {
  describe('name validation', () => {
    it('should allow valid company names', async () => {
      const dto = new UpdateCompanyNameDto();
      dto.name = 'Test Company Inc.';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty name', async () => {
      const dto = new UpdateCompanyNameDto();
      dto.name = '';

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors).toHaveLength(1);
      expect(nameErrors[0].constraints?.isNotEmpty).toBe('Company name is required');
    });

    it('should reject whitespace-only name', async () => {
      const dto = new UpdateCompanyNameDto();
      dto.name = '   ';

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors).toHaveLength(1);
      expect(nameErrors[0].constraints?.isNotEmpty).toBe('Company name is required');
    });

    it('should reject names longer than 100 characters', async () => {
      const dto = new UpdateCompanyNameDto();
      dto.name = 'A'.repeat(101); // 101 characters

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors).toHaveLength(1);
      expect(nameErrors[0].constraints?.maxLength).toBe('Company name cannot exceed 100 characters');
    });

    it('should allow names exactly 100 characters', async () => {
      const dto = new UpdateCompanyNameDto();
      dto.name = 'A'.repeat(100); // Exactly 100 characters

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors).toHaveLength(0);
    });

    it('should reject undefined name', async () => {
      const dto = new UpdateCompanyNameDto();
      // name is undefined by default

      const errors = await validate(dto);
      const nameErrors = errors.filter(error => error.property === 'name');
      
      expect(nameErrors).toHaveLength(1);
      expect(nameErrors[0].constraints?.isNotEmpty).toBe('Company name is required');
    });
  });
});

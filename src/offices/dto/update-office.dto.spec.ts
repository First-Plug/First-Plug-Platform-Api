import { validate } from 'class-validator';
import { UpdateOfficeDto } from './update-office.dto';

describe('UpdateOfficeDto', () => {
  describe('email validation', () => {
    it('should allow valid email addresses', async () => {
      const dto = new UpdateOfficeDto();
      dto.email = 'test@example.com';

      const errors = await validate(dto);
      const emailErrors = errors.filter(error => error.property === 'email');
      
      expect(emailErrors).toHaveLength(0);
    });

    it('should allow empty string to delete email', async () => {
      const dto = new UpdateOfficeDto();
      dto.email = '';

      const errors = await validate(dto);
      const emailErrors = errors.filter(error => error.property === 'email');
      
      expect(emailErrors).toHaveLength(0);
    });

    it('should allow undefined email', async () => {
      const dto = new UpdateOfficeDto();
      // email is undefined by default

      const errors = await validate(dto);
      const emailErrors = errors.filter(error => error.property === 'email');
      
      expect(emailErrors).toHaveLength(0);
    });

    it('should reject invalid email addresses', async () => {
      const dto = new UpdateOfficeDto();
      dto.email = 'invalid-email';

      const errors = await validate(dto);
      const emailErrors = errors.filter(error => error.property === 'email');
      
      expect(emailErrors).toHaveLength(1);
      expect(emailErrors[0].constraints).toHaveProperty('isEmail');
    });

    it('should reject invalid email addresses that are not empty', async () => {
      const dto = new UpdateOfficeDto();
      dto.email = 'not-an-email-address';

      const errors = await validate(dto);
      const emailErrors = errors.filter(error => error.property === 'email');
      
      expect(emailErrors).toHaveLength(1);
      expect(emailErrors[0].constraints).toHaveProperty('isEmail');
    });
  });

  describe('other fields validation', () => {
    it('should allow valid office data', async () => {
      const dto = new UpdateOfficeDto();
      dto.name = 'Test Office';
      dto.phone = '+1234567890';
      dto.address = '123 Test St';
      dto.city = 'Test City';
      dto.state = 'Test State';
      dto.country = 'Test Country';
      dto.zipCode = '12345';
      dto.apartment = 'Apt 1';

      const errors = await validate(dto);
      
      expect(errors).toHaveLength(0);
    });
  });
});

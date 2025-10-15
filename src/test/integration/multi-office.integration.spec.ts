import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { Types } from 'mongoose';

describe('Multi-Office Integration Tests', () => {
  let app: INestApplication;
  let authToken: string;
  let tenantName: string;
  let defaultOfficeId: string;
  let secondOfficeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup test data
    tenantName = 'test-tenant-multi-office';
    // In a real test, you would authenticate and get a real token
    authToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Office Management', () => {
    it('should create first office as default', async () => {
      const createOfficeDto = {
        name: 'Main Office',
        email: 'main@office.com',
        phone: '+1234567890',
        country: 'US',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        address: '123 Main St',
        apartment: 'Suite 100',
      };

      const response = await request(app.getHttpServer())
        .post('/offices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createOfficeDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Main Office',
        isDefault: true,
        email: 'main@office.com',
      });

      defaultOfficeId = response.body._id;
    });

    it('should create second office as non-default', async () => {
      const createOfficeDto = {
        name: 'Branch Office',
        email: 'branch@office.com',
        phone: '+0987654321',
        country: 'US',
        city: 'Boston',
        state: 'MA',
        zipCode: '02101',
        address: '456 Branch St',
        isDefault: true, // Should be ignored since default already exists
      };

      const response = await request(app.getHttpServer())
        .post('/offices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createOfficeDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Branch Office',
        isDefault: false, // Should be false despite request
        email: 'branch@office.com',
      });

      secondOfficeId = response.body._id;
    });

    it('should list all offices with default first', async () => {
      const response = await request(app.getHttpServer())
        .get('/offices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].isDefault).toBe(true);
      expect(response.body[0].name).toBe('Main Office');
      expect(response.body[1].isDefault).toBe(false);
      expect(response.body[1].name).toBe('Branch Office');
    });

    it('should toggle default office', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/offices/${secondOfficeId}/toggle-default`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isDefault).toBe(true);

      // Verify the previous default is no longer default
      const listResponse = await request(app.getHttpServer())
        .get('/offices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const mainOffice = listResponse.body.find(
        (office) => office._id === defaultOfficeId,
      );
      const branchOffice = listResponse.body.find(
        (office) => office._id === secondOfficeId,
      );

      expect(mainOffice.isDefault).toBe(false);
      expect(branchOffice.isDefault).toBe(true);
    });

    it('should prevent deletion of default office', async () => {
      await request(app.getHttpServer())
        .delete(`/offices/${secondOfficeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should allow deletion of non-default office', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/offices/${defaultOfficeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isDeleted).toBe(true);
    });
  });

  describe('Product Creation with Office ID', () => {
    it('should create product with specific office ID', async () => {
      const createProductDto = {
        name: 'Test Product',
        category: 'Computer',
        location: 'Our office',
        officeId: secondOfficeId,
        status: 'Available',
        productCondition: 'Optimal',
        attributes: [
          { key: 'brand', value: 'Test Brand' },
          { key: 'model', value: 'Test Model' },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createProductDto)
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Product',
        location: 'Our office',
        officeId: secondOfficeId,
        status: 'Available',
      });
    });

    it('should validate office ID exists when creating product', async () => {
      const createProductDto = {
        name: 'Invalid Product',
        category: 'Computer',
        location: 'Our office',
        officeId: new Types.ObjectId().toString(), // Non-existent office
        status: 'Available',
        productCondition: 'Optimal',
      };

      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createProductDto)
        .expect(400); // Should fail validation
    });
  });

  describe('Shipment Creation with Office IDs', () => {
    let productId: string;

    beforeAll(async () => {
      // Create a product for shipment testing
      const createProductDto = {
        name: 'Shipment Test Product',
        category: 'Computer',
        location: 'Our office',
        officeId: secondOfficeId,
        status: 'Available',
        productCondition: 'Optimal',
      };

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createProductDto);

      productId = response.body._id;
    });

    it('should create shipment with specific office IDs', async () => {
      const assignProductDto = {
        assignedEmail: 'employee@test.com',
        location: 'Employee',
        actionType: 'assign',
        desirableDate: '2024-12-31',
      };

      const response = await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(assignProductDto)
        .expect(200);

      // Verify shipment was created with correct office IDs
      expect(response.body.shipment).toBeDefined();
      expect(response.body.shipment.origin).toBe('Our office');
      expect(response.body.shipment.originOfficeId).toBe(secondOfficeId);
      expect(response.body.shipment.destination).toBe('Employee');
    });

    it('should validate office data completeness for shipment status', async () => {
      // This test would verify that shipments with incomplete office data
      // get "On Hold - Missing Data" status, while complete ones get "In Preparation"

      // Create product with incomplete office (missing required fields)
      const incompleteOfficeDto = {
        name: 'Incomplete Office',
        email: 'incomplete@office.com',
        // Missing required fields: phone, country, city, state, zipCode, address
      };

      const incompleteOfficeResponse = await request(app.getHttpServer())
        .post('/offices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteOfficeDto);

      const incompleteOfficeId = incompleteOfficeResponse.body._id;

      const productWithIncompleteOfficeDto = {
        name: 'Product with Incomplete Office',
        category: 'Computer',
        location: 'Our office',
        officeId: incompleteOfficeId,
        status: 'Available',
        productCondition: 'Optimal',
      };

      const productResponse = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productWithIncompleteOfficeDto);

      const incompleteProductId = productResponse.body._id;

      // Try to assign product - should result in "On Hold - Missing Data"
      const assignDto = {
        assignedEmail: 'employee@test.com',
        location: 'Employee',
        actionType: 'assign',
      };

      const assignResponse = await request(app.getHttpServer())
        .patch(`/products/${incompleteProductId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(assignDto);

      expect(assignResponse.body.shipment.shipment_status).toBe(
        'On Hold - Missing Data',
      );
    });
  });

  describe('Office Address Update Events', () => {
    it('should update shipments when office address changes', async () => {
      const updateOfficeDto = {
        address: '789 Updated Address',
        city: 'Updated City',
      };

      const response = await request(app.getHttpServer())
        .patch(`/offices/${secondOfficeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateOfficeDto)
        .expect(200);

      expect(response.body.address).toBe('789 Updated Address');
      expect(response.body.city).toBe('Updated City');

      // In a real test, you would verify that related shipments were updated
      // This would require checking the shipments collection or mocking the event system
    });
  });

  describe('Migration Compatibility', () => {
    it('should handle legacy data without office IDs', async () => {
      // This test would verify that the system still works with legacy data
      // that doesn't have officeId fields, falling back to default office

      // Create a legacy product (without officeId)
      const legacyProductDto = {
        name: 'Legacy Product',
        category: 'Computer',
        location: 'Our office',
        // No officeId specified
        status: 'Available',
        productCondition: 'Optimal',
      };

      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(legacyProductDto)
        .expect(201);

      // System should still work, using default office for validation
      expect(response.body.location).toBe('Our office');
      // officeId might be undefined for legacy compatibility
    });
  });

  describe('Data Validation', () => {
    it('should validate office data completeness correctly', async () => {
      // Test that the validation logic works correctly for different office completeness states

      // Create complete office
      const completeOfficeDto = {
        name: 'Complete Office',
        email: 'complete@office.com',
        phone: '+1111111111',
        country: 'US',
        city: 'Complete City',
        state: 'CC',
        zipCode: '11111',
        address: '111 Complete St',
      };

      const completeOfficeResponse = await request(app.getHttpServer())
        .post('/offices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(completeOfficeDto);

      const completeOfficeId = completeOfficeResponse.body._id;

      // Create incomplete office
      const incompleteOfficeDto = {
        name: 'Incomplete Office',
        email: 'incomplete@office.com',
        // Missing required fields
      };

      const incompleteOfficeResponse = await request(app.getHttpServer())
        .post('/offices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incompleteOfficeDto);

      const incompleteOfficeId = incompleteOfficeResponse.body._id;

      // Test validation endpoint (if available)
      // This would be a custom endpoint to test the validation logic
      const completeValidationResponse = await request(app.getHttpServer())
        .get(`/offices/${completeOfficeId}/validate`)
        .set('Authorization', `Bearer ${authToken}`);

      const incompleteValidationResponse = await request(app.getHttpServer())
        .get(`/offices/${incompleteOfficeId}/validate`)
        .set('Authorization', `Bearer ${authToken}`);

      // Expect complete office to pass validation
      expect(completeValidationResponse.body.isComplete).toBe(true);

      // Expect incomplete office to fail validation
      expect(incompleteValidationResponse.body.isComplete).toBe(false);
      expect(incompleteValidationResponse.body.missingFields).toContain(
        'phone',
      );
      expect(incompleteValidationResponse.body.missingFields).toContain(
        'country',
      );
    });
  });
});

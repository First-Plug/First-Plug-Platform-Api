import { Logger, InternalServerErrorException } from '@nestjs/common';
import {
  ProductDocument,
  ProductSchema,
} from 'src/products/schemas/product.schema';
import {
  MemberDocument,
  MemberSchema,
} from 'src/members/schemas/member.schema';
import { TenantsService } from 'src/tenants/tenants.service';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';

const logger = new Logger('MigratePriceScript');
const defaultPrice = { amount: 0, currencyCode: 'USD' };

export async function migratePriceForTenant(
  tenantName: string,
  connectionService: TenantConnectionService,
): Promise<any> {
  try {
    const tenantDbName = `tenant_${tenantName}`;
    const connection = await connectionService.getTenantConnection(tenantName);

    const ProductModel = connection.model<ProductDocument>(
      'Product',
      ProductSchema,
    );
    const MemberModel = connection.model<MemberDocument>(
      'Member',
      MemberSchema,
    );

    const unassignedProducts = await ProductModel.find({
      price: { $exists: false },
    });

    for (const product of unassignedProducts) {
      product.price = defaultPrice;
      await product.save();
      logger.log(
        `Updated unassigned product ${product._id} in ${tenantDbName} with price: ${JSON.stringify(defaultPrice)}`,
      );
    }

    const members = await MemberModel.find();
    for (const member of members) {
      let updated = false;
      for (const product of member.products) {
        if (!product.price) {
          product.price = defaultPrice;
          updated = true;
        }
      }
      if (updated) {
        await member.save();
        logger.log(
          `Updated products in member ${member._id} in ${tenantDbName} with price: ${JSON.stringify(defaultPrice)}`,
        );
      }
    }

    return {
      message: `Migrated price field for tenant ${tenantDbName}`,
    };
  } catch (error) {
    logger.error('Failed to migrate price field', error);
    throw new InternalServerErrorException(
      'Failed to migrate price field for the specified tenant',
    );
  }
}

export async function migratePriceForAllTenants(
  tenantsService: TenantsService,
  connectionService: TenantConnectionService,
) {
  try {
    const tenants = await tenantsService.findAllTenants();

    for (const tenant of tenants) {
      await migratePriceForTenant(tenant.tenantName, connectionService);
    }

    return {
      message: 'Migrated price field for all tenants',
    };
  } catch (error) {
    logger.error('Failed to migrate price field', error);
    throw new InternalServerErrorException(
      'Failed to migrate price field for all tenants',
    );
  }
}

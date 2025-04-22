import { Connection } from 'mongoose';
import { Member, MemberSchema } from '../../members/schemas/member.schema';
import { Product, ProductSchema } from '../../products/schemas/product.schema';
import { Order, OrderSchema } from '../../orders/schemas/order.schema';
import { Team, TeamSchema } from 'src/teams/schemas/team.schema';
import { History, HistorySchema } from 'src/history/schemas/history.schema';
import {
  ShipmentMetadata,
  ShipmentMetadataSchema,
} from 'src/shipments/schema/shipment-metadata.schema';
import { Shipment, ShipmentSchema } from 'src/shipments/schema/shipment.schema';
import { Scope } from '@nestjs/common';

export const tenantModels = {
  productModel: {
    provide: 'PRODUCT_MODEL',
    scope: Scope.REQUEST,
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Product.name, ProductSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  memberModel: {
    provide: 'MEMBER_MODEL',
    scope: Scope.REQUEST,
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Member.name, MemberSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  teamModel: {
    provide: 'TEAM_MODEL',
    scope: Scope.REQUEST,
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Team.name, TeamSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  historyModel: {
    provide: 'HISTORY_MODEL',
    scope: Scope.REQUEST,
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(History.name, HistorySchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  orderModel: {
    provide: 'ORDER_MODEL',
    scope: Scope.REQUEST,
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Order.name, OrderSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  shipmentModel: {
    provide: 'SHIPMENT_MODEL',
    scope: Scope.REQUEST,
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Shipment.name, ShipmentSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  shipmentMetadataModel: {
    provide: 'SHIPMENT_METADATA_MODEL',
    scope: Scope.REQUEST,
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(
        ShipmentMetadata.name,
        ShipmentMetadataSchema,
        'shipmentmetadata',
      );
    },
    inject: ['TENANT_CONNECTION'],
  },
};

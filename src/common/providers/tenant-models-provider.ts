import { Connection } from 'mongoose';
import { Member, MemberSchema } from '../../members/schemas/member.schema';
import { Product, ProductSchema } from '../../products/schemas/product.schema';
import { Order, OrderSchema } from '../../orders/schemas/order.schema';
import {
  Shipment,
  ShipmentSchema,
} from '../../shipments/schemas/shipment.schema';
import { Team, TeamSchema } from 'src/teams/schemas/team.schema';

export const tenantModels = {
  productModel: {
    provide: 'PRODUCT_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Product.name, ProductSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  memberModel: {
    provide: 'MEMBER_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Member.name, MemberSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  teamModel: {
    provide: 'TEAM_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Team.name, TeamSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  orderModel: {
    provide: 'ORDER_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Order.name, OrderSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  shipmentModel: {
    provide: 'SHIPMENT_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Shipment.name, ShipmentSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
};

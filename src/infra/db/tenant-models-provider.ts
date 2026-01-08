import { Connection } from 'mongoose';
import { Member, MemberSchema } from '../../members/schemas/member.schema';
import { Product, ProductSchema } from '../../products/schemas/product.schema';
import { Order, OrderSchema } from '../../orders/schemas/order.schema';
import { Team, TeamSchema } from 'src/teams/schemas/team.schema';
import { History, HistorySchema } from 'src/history/schemas/history.schema';
import { Office, OfficeSchema } from 'src/offices/schemas/office.schema';
import {
  ShipmentMetadata,
  ShipmentMetadataSchema,
} from 'src/shipments/schema/shipment-metadata.schema';
import { Quote, QuoteSchema } from 'src/quotes/schemas/quote.schema';

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
  historyModel: {
    provide: 'HISTORY_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(History.name, HistorySchema);
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
  officeModel: {
    provide: 'OFFICE_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Office.name, OfficeSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
  shipmentMetadataModel: {
    provide: 'SHIPMENT_METADATA_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(
        ShipmentMetadata.name,
        ShipmentMetadataSchema,
        'shipmentmetadata',
      );
    },
    inject: ['TENANT_CONNECTION'],
  },
  quoteModel: {
    provide: 'QUOTE_MODEL',
    useFactory: async (tenantConnection: Connection) => {
      return tenantConnection.model(Quote.name, QuoteSchema);
    },
    inject: ['TENANT_CONNECTION'],
  },
};

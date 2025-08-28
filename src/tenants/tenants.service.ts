import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Tenant } from './schemas/tenant.schema';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { InjectSlack } from 'nestjs-slack-webhook';
import { IncomingWebhook } from '@slack/webhook';
// import { UpdateTenantInformationSchemaDto } from './dto/update-information.dto';
// import { UserJWT } from 'src/auth/interfaces/auth.interface';
import { UpdateDashboardSchemaDto } from './dto/update-dashboard.dto';
// import { TenantAddressUpdatedEvent } from 'src/infra/event-bus/tenant-address-update.event';
import { EventEmitter2 } from '@nestjs/event-emitter';
// import { EventTypes } from 'src/infra/event-bus/types';

@Injectable()
export class TenantsService {
  private slackMerchWebhook: IncomingWebhook;
  private slackShopWebhook: IncomingWebhook;
  private slackComputerUpgradeWebhook: IncomingWebhook;
  private readonly logger = new Logger(TenantsService.name);
  constructor(
    @InjectModel(Tenant.name)
    private tenantRepository: Model<Tenant>,
    @InjectSlack() private readonly slack: IncomingWebhook,
    private eventEmitter: EventEmitter2,
  ) {
    const slackMerchWebhookUrl = process.env.SLACK_WEBHOOK_URL_MERCH;
    const slackShopWebhookUrl = process.env.SLACK_WEBHOOK_URL_SHOP;
    const slackComputerUpgradeWebhook =
      process.env.SLACK_WEBHOOK_URL_COMPUTER_UPGRADE;

    if (!slackMerchWebhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL_MERCH is not defined');
    }

    if (!slackShopWebhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL_SHOP is not defined');
    }

    if (!slackComputerUpgradeWebhook) {
      throw new Error('SLACK_WEBHOOK_URL_COMPUTER_UPGRADE is not defined');
    }

    this.slackMerchWebhook = new IncomingWebhook(slackMerchWebhookUrl);
    this.slackShopWebhook = new IncomingWebhook(slackShopWebhookUrl);
    this.slackComputerUpgradeWebhook = new IncomingWebhook(
      slackComputerUpgradeWebhook,
    );
  }

  async notifyComputerUpgrade(data: {
    email: string;
    tenantName: string;
    category: string;
    brand: string;
    model: string;
    serialNumber: string;
    acquisitionDate: string;
    status: string;
    location: string;
    assignedMember?: string;
  }) {
    const {
      email,
      tenantName,
      category,
      brand,
      model,
      serialNumber,
      acquisitionDate,
      status,
      location,
      assignedMember,
    } = data;

    const locationMessage =
      location === 'Employee' && assignedMember
        ? `*Assigned to:* ${assignedMember}`
        : `*Ubicación:* ${location}`;

    const message =
      `*Cliente:* ${tenantName} (${email})\n` +
      `*Producto:* *${category} ${brand} ${model}*\n` +
      `*Serial:* ${serialNumber}\n` +
      `${isFinite(parseFloat(acquisitionDate)) ? `*Fecha de adquisición:* ${parseFloat(acquisitionDate).toFixed(1)} years\n` : ''}` +
      `*Estado:* ${status}\n` +
      `${locationMessage}`;
    try {
      await this.slackComputerUpgradeWebhook.send(message);

      return { message: 'Notification sent to Slack' };
    } catch (error) {
      console.error('Error sending notification to Slack:', error);
      throw new Error('Failed to send notification to Slack');
    }
  }

  async notifyBirthdayGiftInterest(email: string, tenantName: string) {
    const message = `Cliente ${email}-${tenantName} está interesado en regalos de cumpleaños`;

    try {
      await this.slackMerchWebhook.send({
        text: message,
        channel: '#merch-cumples',
      });

      return { message: 'Notification sent to Slack' };
    } catch (error) {
      console.error('Error sending notification to Slack:', error);
      throw new Error('Failed to send notification to Slack');
    }
  }

  async notifyShopInterest(email: string, tenantName: string) {
    const message = `Cliente ${email}-${tenantName} está interesado en nuestro shop/productos.`;

    try {
      await this.slackShopWebhook.send({
        text: message,
        channel: 'shop',
      });

      return { message: 'Notification sent to Slack' };
    } catch (error) {
      console.error('Error sending notification to Slack:', error);
      throw new Error('Failed to send notification to Slack');
    }
  }

  async findAllTenants() {
    const tenants = await this.tenantRepository
      .find({}, null, { sort: { createdAt: -1 } })
      .lean()
      .exec();
    if (!tenants || tenants.length === 0) {
      throw new Error('No se encontraron tenants en la base de datos');
    }
    return tenants;
  }

  async migrateRecoverableConfig(tenantName: string) {
    const tenants = await this.tenantRepository.find({ tenantName });

    if (!tenants || tenants.length === 0) {
      throw new Error(
        `No se encontró ningún tenant con el tenantName ${tenantName}`,
      );
    }

    const updated = await this.tenantRepository.updateMany(
      { tenantName },
      {
        $set: {
          isRecoverableConfig: new Map([
            ['Merchandising', false],
            ['Computer', true],
            ['Monitor', true],
            ['Audio', true],
            ['Peripherals', true],
            ['Other', true],
          ]),
        },
      },
    );

    if (updated.modifiedCount > 0) {
      console.log(
        `Configuración de isRecoverable migrada para ${updated.modifiedCount} usuarios con tenantName: ${tenantName}`,
      );
    } else {
      console.log(
        `No se realizaron cambios en la configuración de isRecoverable para tenantName: ${tenantName}`,
      );
    }
  }

  async migrateComputerExpiration(tenantName: string) {
    const tenants = await this.tenantRepository.find({ tenantName });

    if (!tenants || tenants.length === 0) {
      throw new Error(
        `No se encontró ningún tenant con el tenantName ${tenantName}`,
      );
    }

    const updated = await this.tenantRepository.updateMany(
      { tenantName },
      { $set: { computerExpiration: 3 } },
    );

    if (updated.modifiedCount > 0) {
      console.log(
        `Se actualizó la propiedad computerExpiration para ${updated.modifiedCount} usuarios con tenantName: ${tenantName}`,
      );
    } else {
      console.log(
        `No se realizaron cambios en la propiedad computerExpiration para tenantName: ${tenantName}`,
      );
    }
  }

  async migrateAllComputerExpirations() {
    const tenants = await this.tenantRepository.find({});

    if (!tenants || tenants.length === 0) {
      throw new Error('No se encontraron tenants en la base de datos');
    }

    const updated = await this.tenantRepository.updateMany(
      {},
      { $set: { computerExpiration: 3 } },
    );

    if (updated.modifiedCount > 0) {
      console.log(
        `Se actualizó la propiedad computerExpiration para ${updated.modifiedCount} tenants.`,
      );
    } else {
      console.log(
        `No se realizaron cambios en la propiedad computerExpiration.`,
      );
    }
  }

  async getRecoverableConfig(tenantName: string) {
    const tenant = await this.tenantRepository.findOne({ tenantName });

    if (!tenant) {
      throw new Error(
        `No se encontró ningún tenant con el tenantName ${tenantName}`,
      );
    }

    return {
      isRecoverableConfig: tenant.isRecoverableConfig,
      computerExpiration: tenant.computerExpiration,
    };

    // return tenant.isRecoverableConfig;
  }

  async updateRecoverableConfig(
    tenantName: string,
    newConfig: Record<string, boolean>,
  ) {
    const configMap = new Map(Object.entries(newConfig));

    const updated = await this.tenantRepository.updateMany(
      { tenantName },
      { $set: { isRecoverableConfig: configMap } },
    );

    if (updated.modifiedCount === 0) {
      throw new Error(
        `No se encontró ningún tenant con el tenantName ${tenantName}`,
      );
    }
  }

  async updateComputerExpiration(tenantName: string, expirationYears: number) {
    const updated = await this.tenantRepository.updateMany(
      { tenantName },
      { $set: { computerExpiration: expirationYears } },
    );

    if (updated.modifiedCount === 0) {
      throw new Error(
        `No se encontró ningún tenant con el tenantName ${tenantName}`,
      );
    }
  }

  async updateTenantName(tenantName: string, newName: string) {
    const updatedTenant = await this.tenantRepository.findOneAndUpdate(
      { tenantName },
      { $set: { name: newName, updatedAt: new Date() } },
      { new: true },
    );

    if (!updatedTenant) {
      throw new Error(
        `No se encontró ningún tenant con el tenantName ${tenantName}`,
      );
    }

    return updatedTenant;
  }

  async createTenant(
    dto: CreateTenantDto,
    createdBy: ObjectId,
  ): Promise<Tenant> {
    const exists = await this.tenantRepository.findOne({
      tenantName: dto.tenantName,
    });

    if (exists) {
      throw new BadRequestException('Ya existe un tenant con ese nombre');
    }

    const tenant = await this.tenantRepository.create({
      ...dto,
      createdBy,
    });

    return tenant;
  }

  // Método para compatibilidad con AuthController
  async create(dto: CreateTenantDto): Promise<Tenant> {
    // Por ahora, usar un ObjectId temporal hasta que se implemente la UI de FirstPlug
    const tempCreatedBy =
      new this.tenantRepository.base.Types.ObjectId() as any;
    return this.createTenant(dto, tempCreatedBy);
  }

  // Método para compatibilidad con AuthController
  async createByProviders(dto: any): Promise<Tenant> {
    // Mapear el DTO de providers al DTO estándar
    const createTenantDto: CreateTenantDto = {
      name: dto.name || dto.email?.split('@')[0] || 'Default Company',
      tenantName: dto.tenantName || dto.email?.split('@')[0] || 'default',
      image: dto.image || '',
    };

    return this.create(createTenantDto);
  }

  async getByTenantName(tenantName: string) {
    return await this.tenantRepository.findOne({ tenantName });
  }

  async getTenantById(id: string) {
    return this.tenantRepository.findById(id);
  }

  async findByEmail(email: string) {
    return await this.tenantRepository.findOne({ email });
  }

  async update(
    userId: ObjectId,
    updateTenantDto: UpdateTenantDto | UpdateDashboardSchemaDto,
  ) {
    return this.tenantRepository.findByIdAndUpdate(userId, updateTenantDto, {
      new: true,
    });
  }

  async findUsersWithSameTenant(tenantName: string, createdAt: Date) {
    return await this.tenantRepository
      .find({
        tenantName,
        createdAt: { $lt: createdAt },
      })
      .sort({ createdAt: 1 });
  }

  async updateUserConfig(userId: ObjectId, updatedConfig: any) {
    return await this.tenantRepository.findByIdAndUpdate(userId, {
      $set: updatedConfig,
    });
  }
}

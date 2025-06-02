import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Tenant } from './schemas/tenant.schema';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { CreateTenantByProvidersDto } from './dto/create-tenant-by-providers.dto';
import { InjectSlack } from 'nestjs-slack-webhook';
import { IncomingWebhook } from '@slack/webhook';
import { UpdateTenantInformationSchemaDto } from './dto/update-information.dto';
import { UserJWT } from 'src/auth/interfaces/auth.interface';
import { UpdateDashboardSchemaDto } from './dto/update-dashboard.dto';
import { TenantAddressUpdatedEvent } from 'src/infra/event-bus/tenant-address-update.event';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventTypes } from 'src/infra/event-bus/types';

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
    const tenants = await this.tenantRepository.find({});
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

  async create(createTenantDto: CreateTenantDto) {
    const user = await this.findByEmail(createTenantDto.email);

    if (user) {
      throw new BadRequestException(
        'The credentials are not valid, please try again.',
      );
    }

    const userCreated = await this.tenantRepository.create(createTenantDto);

    this.slack.send(
      `El usuario ${userCreated.email} se registró correctamente. Por favor habilitarlo cuanto antes y darle aviso para que pueda ingresar a la plataforma.`,
    );
  }

  async createByProviders(
    createTenantByProvidersDto: CreateTenantByProvidersDto,
  ) {
    const user = await this.findByEmail(createTenantByProvidersDto.email);

    if (user) {
      user.name = createTenantByProvidersDto.name;
      user.image = createTenantByProvidersDto.image;
      user.accountProvider = createTenantByProvidersDto.accountProvider;
      await user.save();
      return user;
    }

    const userCreated = await this.tenantRepository.create(
      createTenantByProvidersDto,
    );

    this.slack.send(
      `El usuario ${userCreated.email} se registró correctamente. Por favor habilitarlo cuanto antes y darle aviso para que pueda ingresar a la plataforma.`,
    );
  }

  async getByTenantName(tenantName: string) {
    return await this.tenantRepository.findOne({ tenantName });
  }
  async getTenantById(id: string) {
    const user = await this.tenantRepository.findOne({ _id: id });
    user?.accountProvider;
    return {
      _id: user?._id,
      phone: user?.phone,
      country: user?.country,
      city: user?.city,
      state: user?.state,
      zipCode: user?.zipCode,
      address: user?.address,
      apartment: user?.apartment,
      image: user?.image,
      tenantName: user?.tenantName,
      name: user?.name,
      email: user?.email,
      accountProvider: user?.accountProvider,
      isRecoverableConfig: user?.isRecoverableConfig,
      computerExpiration: user?.computerExpiration,
      widgets: user?.widgets,
    };
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

  async updateInformation(
    user: UserJWT,
    updateTenantInformationSchemaDto: UpdateTenantInformationSchemaDto,
    ourOfficeEmail: string,
  ) {
    // First, get the current user data before update
    const currentUser = await this.tenantRepository.findById(user._id);
    if (!currentUser) {
      throw new Error(`No se encontró el usuario con id: ${user._id}`);
    }

    // Store the old address data before any updates
    const oldAddress = {
      address: currentUser.address,
      apartment: currentUser.apartment,
      city: currentUser.city,
      state: currentUser.state,
      country: currentUser.country,
      zipCode: currentUser.zipCode,
      phone: currentUser.phone,
    };

    // Perform the update
    const userUpdated = await this.tenantRepository.findByIdAndUpdate(
      user._id,
      updateTenantInformationSchemaDto,
      { new: true },
    );

    if (!userUpdated) {
      throw new Error(`No se encontró el usuario con id: ${user._id}`);
    }

    const updateFields = {
      phone: updateTenantInformationSchemaDto.phone,
      country: updateTenantInformationSchemaDto.country,
      city: updateTenantInformationSchemaDto.city,
      state: updateTenantInformationSchemaDto.state,
      zipCode: updateTenantInformationSchemaDto.zipCode,
      address: updateTenantInformationSchemaDto.address,
      apartment: updateTenantInformationSchemaDto.apartment,
      image: updateTenantInformationSchemaDto.image,
    };

    if (userUpdated?.tenantName) {
      await this.tenantRepository.updateMany(
        { tenantName: userUpdated.tenantName, _id: { $ne: user._id } },
        { $set: updateFields },
      );
    }

    // Check if there are actual changes in the address fields
    const hasAddressChanges = Object.keys(oldAddress).some(
      (key) => oldAddress[key] !== updateFields[key],
    );

    if (hasAddressChanges) {
      this.logger.debug('Emitting tenant address update event', {
        tenantName: userUpdated.tenantName,
        oldAddress,
        newAddress: updateFields,
      });

      this.eventEmitter.emit(
        EventTypes.TENANT_ADDRESS_UPDATED,
        new TenantAddressUpdatedEvent(
          userUpdated.tenantName,
          oldAddress,
          updateFields,
          new Date(),
          user._id.toString(),
          ourOfficeEmail,
        ),
      );
    }

    return {
      phone: userUpdated?.phone,
      country: userUpdated?.country,
      city: userUpdated?.city,
      state: userUpdated?.state,
      zipCode: userUpdated?.zipCode,
      address: userUpdated?.address,
      apartment: userUpdated?.apartment,
      image: userUpdated?.image,
      accountProvider: userUpdated?.accountProvider,
    };
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

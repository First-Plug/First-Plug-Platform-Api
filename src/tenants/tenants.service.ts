import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Tenant } from './schemas/tenant.schema';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { CreateTenantByProvidersDto } from './dto/create-tenant-by-providers.dto';
import { InjectSlack } from 'nestjs-slack-webhook';
import { IncomingWebhook } from '@slack/webhook';
import { UpdateTenantInformationSchemaDto } from './dto/update-information.dto';
import { UserJWT } from 'src/auth/interfaces/auth.interface';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name)
    private tenantRepository: Model<Tenant>,
    @InjectSlack() private readonly slack: IncomingWebhook,
  ) {}

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
    };
  }

  async findByEmail(email: string) {
    return await this.tenantRepository.findOne({ email });
  }

  async update(userId: ObjectId, updateTenantDto: UpdateTenantDto) {
    return this.tenantRepository.findByIdAndUpdate(userId, updateTenantDto);
  }

  async updateInformation(
    user: UserJWT,
    updateTenantInformationSchemaDto: UpdateTenantInformationSchemaDto,
  ) {
    const userUpdated = await this.tenantRepository.findByIdAndUpdate(
      user._id,
      updateTenantInformationSchemaDto,
      { new: true },
    );

    const sanitizedUser = {
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

    return sanitizedUser;
  }
}

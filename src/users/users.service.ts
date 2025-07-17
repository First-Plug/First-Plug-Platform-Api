import {
  Injectable,
  BadRequestException,
  //   NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema';
import { InjectSlack } from 'nestjs-slack-webhook';
import { IncomingWebhook } from '@slack/webhook';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserByProviderDto } from './dto/create-user-by-provider.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectSlack() private readonly slack: IncomingWebhook,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return await this.userModel.findOne({ email });
  }

  async findByTenantName(tenantName: string): Promise<User | null> {
    // Buscar usuarios del esquema viejo que tienen tenantName directo
    return await this.userModel.findOne({ tenantName });
  }

  async findById(id: string | Types.ObjectId): Promise<User | null> {
    return await this.userModel.findById(id);
  }

  async getById(id: string | Types.ObjectId): Promise<User | null> {
    return this.findById(id);
  }

  async create(createUserDto: CreateUserDto) {
    const existing = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (existing) throw new BadRequestException('Email already in use');

    const user = new this.userModel({
      ...createUserDto,
      status: 'pending',
      isActive: true,
    });

    await user.save();

    await this.slack.send(
      `El usuario ${user.email} se registró correctamente. Por favor habilitarlo cuanto antes y darle aviso para que pueda ingresar a la plataforma.`,
    );
    return user;
  }

  async createByProvider(dto: CreateUserByProviderDto) {
    let user = await this.userModel.findOne({ email: dto.email });

    if (user) {
      user.firstName = dto.name.split(' ')[0];
      user.lastName = dto.name.split(' ').slice(1).join(' ');
      user.image = dto.image;
      user.accountProvider = dto.accountProvider;
      await user.save();
      return user;
    }

    user = new this.userModel({
      email: dto.email,
      firstName: dto.name.split(' ')[0],
      lastName: dto.name.split(' ').slice(1).join(' '),
      image: dto.image,
      accountProvider: dto.accountProvider,
      status: 'pending',
      isActive: true,
    });

    await user.save();

    await this.slack.send(
      `El usuario ${user.email} se registró correctamente con ${dto.accountProvider}. Por favor habilitarlo cuanto antes y darle aviso para que pueda ingresar a la plataforma.`,
    );

    return user;
  }

  async updateUserConfig(
    userId: Types.ObjectId,
    updatedConfig: Partial<User>,
  ): Promise<User> {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updatedConfig },
      { new: true },
    );

    if (!updatedUser) {
      throw new Error(`No se encontró el usuario con id: ${userId}`);
    }

    return updatedUser;
  }

  async findUsersWithSameTenant(
    tenantId: Types.ObjectId,
    createdAt: Date,
  ): Promise<User[]> {
    return this.userModel
      .find({ tenantId, createdAt: { $lt: createdAt } })
      .sort({ createdAt: 1 });
  }

  async activateUser(userId: Types.ObjectId): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { status: 'active' },
      { new: true },
    );

    if (!user) {
      throw new Error(`No se encontró el usuario con id: ${userId}`);
    }

    return user;
  }

  async assignTenant(
    userId: Types.ObjectId,
    tenantId: Types.ObjectId,
  ): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        tenantId,
        status: 'active', // Activar usuario al asignar tenant
      },
      { new: true },
    );

    if (!user) {
      throw new Error(`No se encontró el usuario con id: ${userId}`);
    }

    console.log('✅ Usuario activado:', {
      email: user.email,
      status: user.status,
      tenantId: user.tenantId,
    });

    return user;
  }

  async assignTenantToMultipleUsers(
    userIds: Types.ObjectId[],
    tenantId: Types.ObjectId,
  ): Promise<{ updatedCount: number }> {
    const result = await this.userModel.updateMany(
      { _id: { $in: userIds } },
      { $set: { tenantId, status: 'active' } }, // Activar usuarios al asignar tenant
    );

    console.log('✅ Usuarios activados en lote:', {
      updatedCount: result.modifiedCount,
      tenantId,
    });

    return { updatedCount: result.modifiedCount };
  }
}

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
import { UpdateUserConfigDto } from './dto/update-user-config.dto';
import * as bcrypt from 'bcrypt';
import { EventsGateway } from 'src/infra/event-bus/events.gateway';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectSlack() private readonly slack: IncomingWebhook,
    private readonly eventsGateway: EventsGateway,
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
    const email = dto.email.trim().toLowerCase();
    let user = await this.userModel.findOne({ email });

    const [firstName, ...rest] = (dto.name ?? '').trim().split(' ');
    const lastName = rest.join(' ');

    if (user) {
      user.firstName = firstName || user.firstName || '';
      user.lastName = lastName || user.lastName || '';
      user.image = dto.image ?? user.image ?? '';
      user.accountProvider = dto.accountProvider;
      await user.save();
      return user.populate('tenantId', 'name tenantName');
    }

    user = new this.userModel({
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      image: dto.image ?? '',
      accountProvider: dto.accountProvider,
      status: 'pending',
      isActive: true,
      role: 'user',
    });

    await user.save();

    await this.slack.send(
      `El usuario ${user.email} se registró con ${dto.accountProvider}.`,
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

  async getUserProfile(userId: string | Types.ObjectId): Promise<User | null> {
    const user = await this.userModel
      .findById(userId)
      .select(
        'firstName lastName email personalEmail phone address apartment city state country zipCode image accountProvider createdAt updatedAt',
      );

    if (!user) {
      return null;
    }

    return user;
  }

  async updateUserProfile(
    userId: string | Types.ObjectId,
    updateData: UpdateUserConfigDto,
  ): Promise<User | null> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true, runValidators: true })
      .select(
        'firstName lastName email personalEmail phone address apartment city state country zipCode image accountProvider createdAt updatedAt',
      );

    if (!updatedUser) {
      return null;
    }

    return updatedUser;
  }

  /**
   * Actualizar datos básicos de usuario (SuperAdmin only)
   */
  async updateUserSuperAdmin(
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
      role?: string;
    },
  ): Promise<User> {
    if (!userId || userId === 'undefined' || userId.trim() === '') {
      throw new BadRequestException('User ID is required and must be valid');
    }

    // Validar que sea un ObjectId válido
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID format');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Filtrar solo los campos que se pueden actualizar
    const allowedUpdates: any = {};
    if (updateData.firstName !== undefined) {
      allowedUpdates.firstName = updateData.firstName;
    }
    if (updateData.lastName !== undefined) {
      allowedUpdates.lastName = updateData.lastName;
    }
    if (updateData.role !== undefined) {
      allowedUpdates.role = updateData.role;
    }

    const updateOps: any = { $set: allowedUpdates };

    if ((updateData.role ?? '').toLowerCase() === 'superadmin') {
      updateOps.$unset = { tenantId: '', tenantName: '' };
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, updateOps, { new: true })
      .populate('tenantId', 'name tenantName');

    if (!updatedUser) {
      throw new BadRequestException('Failed to update user');
    }

    this.eventsGateway.notifyTenant(
      updatedUser.tenantName as string,
      'user-profile-updated',
      {
        user: updatedUser,
      },
    );

    return updatedUser;
  }

  // ==================== SUPERADMIN METHODS ====================

  /**
   * Obtener usuarios sin tenant asignado (para SuperAdmin)
   */
  async findUnassignedUsers(): Promise<User[]> {
    return await this.userModel
      .find({
        $and: [
          { tenantId: { $exists: false } }, // Sin tenantId
          { role: { $ne: 'superadmin' } }, // No SuperAdmins
          { isDeleted: false },
          { isActive: true },
        ],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Obtener usuarios con tenant asignado o SuperAdmins (para SuperAdmin)
   */
  async findAssignedUsers(): Promise<User[]> {
    return await this.userModel
      .find({
        $and: [
          {
            $or: [{ tenantId: { $exists: true } }, { role: 'superadmin' }],
          },
          { isDeleted: false },
        ],
      })
      .populate('tenantId', 'name tenantName')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Asignar tenant a usuario (para SuperAdmin)
   */
  async assignTenantSuperAdmin(
    userId: string,
    tenantId?: string,
    role: string = 'user',
    tenantName?: string,
  ): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const update: any = {
      role,
      status: 'active',
    };

    if (role === 'superadmin') {
      update.tenantId = null;
      update.tenantName = null;
    } else {
      if (!tenantId) {
        throw new BadRequestException(
          'tenantId is required for non-superadmin roles',
        );
      }
      update.tenantId = new Types.ObjectId(tenantId);
      if (typeof tenantName === 'string') {
        update.tenantName = tenantName;
      }
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, update, { new: true })
      .populate('tenantId', 'name tenantName');

    if (!updatedUser) {
      throw new BadRequestException('Failed to assign tenant');
    }

    return updatedUser;
  }

  /**
   * Toggle active status (para SuperAdmin)
   * Actualiza tanto isActive como status
   */
  async toggleActiveStatus(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const newActiveStatus = !user.isActive;
    const newStatus = newActiveStatus ? 'active' : 'inactive';

    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          isActive: newActiveStatus,
          status: newStatus,
        },
        { new: true },
      )
      .populate('tenantId', 'name');

    if (!updatedUser) {
      throw new BadRequestException('Failed to update user');
    }

    return updatedUser;
  }

  /**
   * Soft delete user (para SuperAdmin)
   */
  async softDelete(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
      { new: true },
    );

    if (!updatedUser) {
      throw new BadRequestException('Failed to delete user');
    }

    return updatedUser;
  }

  /**
   * Obtener TODOS los usuarios del sistema (para SuperAdmin)
   */
  async findAllUsers(): Promise<User[]> {
    const users = await this.userModel
      .find({
        isDeleted: false, // Solo usuarios no eliminados
      })
      .populate('tenantId', 'name tenantName') // Incluir info del tenant
      .sort({ createdAt: -1 })
      .exec();

    console.log('✅ Usuarios obtenidos:', {
      total: users.length,
      withTenant: users.filter((u) => u.tenantId).length,
      withoutTenant: users.filter((u) => !u.tenantId).length,
      superAdmins: users.filter((u) => u.role === 'superadmin').length,
    });

    return users;
  }

  // ==================== MÉTODO TEMPORAL ====================

  /**
   * MÉTODO TEMPORAL: Resetear password de SuperAdmin
   * ELIMINAR DESPUÉS DE USAR
   */
  async resetSuperAdminPassword() {
    const newPassword = 'superadmin123';
    const saltRounds = 10;

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    const salt = await bcrypt.genSalt(saltRounds);

    const updatedUser = await this.userModel.findOneAndUpdate(
      { email: 'superadmin@mail.com' },
      {
        password: hashedPassword,
        salt: salt,
      },
      { new: true },
    );

    if (!updatedUser) {
      throw new BadRequestException('SuperAdmin no encontrado');
    }

    return {
      message: 'Password de SuperAdmin reseteado exitosamente',
      email: 'superadmin@mail.com',
      newPassword: newPassword,
      warning: 'ELIMINAR ESTE ENDPOINT DESPUÉS DE USAR',
    };
  }
}

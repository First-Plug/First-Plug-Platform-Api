import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ClientSession, Connection, Model, ObjectId, Schema } from 'mongoose';
import { MemberDocument } from './schemas/member.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { CreateProductDto } from 'src/products/dto';
import { Team } from 'src/teams/schemas/team.schema';
import { ProductModel } from 'src/products/products.service';
import { InjectConnection } from '@nestjs/mongoose';
import { TeamsService } from 'src/teams/teams.service';
import { InjectSlack } from 'nestjs-slack-webhook';
import { IncomingWebhook } from '@slack/webhook';

export interface MemberModel
  extends Model<MemberDocument>,
    SoftDeleteModel<MemberDocument> {}

@Injectable()
export class MembersService {
  private slackOffboardingWebhook: IncomingWebhook;
  private readonly logger = new Logger(MembersService.name);
  constructor(
    @Inject('MEMBER_MODEL') private memberRepository: MemberModel,
    @Inject('PRODUCT_MODEL') private productRepository: ProductModel,
    @Inject('TEAM_MODEL') private teamRepository: Model<Team>,
    @InjectConnection() private readonly connection: Connection,
    private readonly teamsService: TeamsService,
    @InjectSlack() private readonly slack: IncomingWebhook,
  ) {
    const slackOffboardingWebhookUrl =
      process.env.SLACK_WEBHOOK_URL_OFFBOARDING;

    if (!slackOffboardingWebhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL_OFFBOARDING is not defined');
    }

    this.slackOffboardingWebhook = new IncomingWebhook(
      slackOffboardingWebhookUrl,
    );
  }

  // already run this methods to create a new property in all existing members.
  // I´ll leave it here for future reference or future new properties
  // async updateDniForTenant(tenantName: string) {
  //   try {
  //     const tenantDbName = `tenant_${tenantName}`;
  //     const connection = this.connection.useDb(tenantDbName);
  //     const MemberModel = connection.model<MemberDocument>(
  //       'Member',
  //       MemberSchema,
  //     );

  //     const members = await MemberModel.find();

  //     for (const member of members) {
  //       if (typeof member.dni === 'undefined') {
  //         member.dni = 0;
  //         await member.save();
  //         this.logger.log(
  //           `Updated member ${member._id} with DNI: ${member.dni}`,
  //         );
  //       }
  //     }
  //   } catch (error) {
  //     this.logger.error('Failed to update member DNI', error);
  //   }
  // }

  // async updateDniForAllTenants() {
  //   try {
  //     const tenantDbNames = await this.connection.db.admin().listDatabases();
  //     for (const tenant of tenantDbNames.databases) {
  //       if (tenant.name.startsWith('tenant_')) {
  //         const connection = this.connection.useDb(tenant.name);
  //         const MemberModel = connection.model<MemberDocument>(
  //           'Member',
  //           MemberSchema,
  //         );

  //         const members = await MemberModel.find();
  //         for (const member of members) {
  //           if (typeof member.dni === 'undefined') {
  //             member.dni = 0; // Asignar 0 como valor por defecto
  //             await member.save();
  //             this.logger.log(
  //               `Updated member ${member._id} in ${tenant.name} with DNI: ${member.dni}`,
  //             );
  //           }
  //         }
  //       }
  //     }
  //   } catch (error) {
  //     this.logger.error('Failed to update member DNI for all tenants', error);
  //   }
  // }

  async notifyOffBoarding(member: any, products: any) {
    const memberOffboardingMessage = {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*Nombre y apellido*: ${member.firstName} ${member.lastName}\n` +
          `*DNI/CI*: ${member.dni}\n` +
          `*Dirección*: ${member.country}, ${member.city}, ${member.address}, ${member.apartment ?? ''}\n` +
          `*Código Postal*: ${member.zipCode}\n` +
          `*Teléfono*: +${member.phone}\n` +
          `*Correo Personal*: ${member.personalEmail}`,
      },
    };

    const productsSend = products.flatMap((product, index) => {
      const productRecoverable = product.product;

      const brandAttribute = productRecoverable.attributes.find(
        (attribute) => attribute.key === 'brand',
      );
      const modelAttribute = productRecoverable.attributes.find(
        (attribute) => attribute.key === 'model',
      );

      const brand = brandAttribute ? brandAttribute.value : '';
      const model = modelAttribute ? modelAttribute.value : '';
      const name = productRecoverable.name ? productRecoverable.name : '';
      const serialNumber = productRecoverable.serialNumber
        ? productRecoverable.serialNumber
        : '';

      const category = productRecoverable.category;

      let relocationAction = '';
      let newMemberInfo = '';

      switch (product.relocation) {
        case 'FP warehouse':
          relocationAction = 'enviar a FP Warehouse';
          break;
        case 'My office':
          relocationAction = 'enviar a oficina del cliente';
          break;
        case 'New employee':
          relocationAction = 'enviar a nuevo miembro\n';
          newMemberInfo =
            `\n*Nombre y apellido*: ${product.newMember.firstName} ${product.newMember.lastName}\n` +
            `*DNI/CI*: ${product.newMember.dni ?? ''}\n` +
            `*Dirección*: ${product.newMember.country}, ${product.newMember.city}, ${product.newMember.address}, ${product.newMember.apartment ?? ''}\n` +
            `*Código Postal*: ${product.newMember.zipCode}\n` +
            `*Teléfono*: +${product.newMember.phone}\n` +
            `*Correo Personal*: ${product.newMember.personalEmail}`;
          break;
      }

      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text:
              `*Producto ${index + 1}*: \n` +
              `Categoría: ${category}\n` +
              `Marca: ${brand}\n` +
              `Modelo: ${model}\n` +
              `Nombre: ${name}\n` +
              `Serial: ${serialNumber}\n` +
              `Acción: ${relocationAction}` +
              newMemberInfo,
          },
        },
        {
          type: 'divider',
        },
      ];
    });

    try {
      await this.slackOffboardingWebhook.send({
        channel: 'offboardings',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Offboarding:*',
            },
          },
          memberOffboardingMessage,
          {
            type: 'divider',
          },
          ...productsSend.slice(0, -1),
        ],
      });

      return { message: 'Notification sent to Slack' };
    } catch (error) {
      console.error('Error sending notification to Slack:', error);
      throw new Error('Failed to send notification to Slack');
    }
  }

  private async validateDni(dni: number) {
    if (!dni) {
      return;
    }
    const memberWithSameDni = await this.memberRepository.findOne({ dni });
    if (memberWithSameDni) {
      // console.log('MEMBER WITH SAME DNI', memberWithSameDni);
      throw new BadRequestException(`DNI ${dni} is already in use`);
    }
  }

  private normalizeTeamName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/(?:^|\s|["'([{])\p{L}/gu, (char) => char.toUpperCase());
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/(?:^|\s)\p{L}/gu, (char) => char.toUpperCase());
  }

  private normalizeMemberData(member: CreateMemberDto) {
    return {
      ...member,
      email: member.email.toLowerCase(),
      firstName: member.firstName
        .trim()
        .toLowerCase()
        .replace(/(?:^|\s)\p{L}/gu, (char) => char.toUpperCase()),
      lastName: member.lastName
        .trim()
        .toLowerCase()
        .replace(/(?:^|\s)\p{L}/gu, (char) => char.toUpperCase()),
      position: member.position
        ? member.position
            .trim()
            .toLowerCase()
            .replace(/(?:^|\s)\p{L}/gu, (char) => char.toUpperCase())
        : undefined,
      team: member.team
        ? member.team
            .trim()
            .toLowerCase()
            .replace(/(?:^|\s)\p{L}/gu, (char) => char.toUpperCase())
        : undefined,
    };
  }

  private getFullName(member: any): string {
    if (member && member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    return '';
  }

  private async assignProductsToMemberByEmail(
    memberEmail: string,
    memberFullName: string,
    session: ClientSession,
  ) {
    const productsToUpdate = await this.productRepository
      .find({ assignedEmail: memberEmail })
      .session(session);

    for (const product of productsToUpdate) {
      product.assignedMember = memberFullName;
      await product.save({ session });
      await this.productRepository
        .deleteOne({ _id: product._id })
        .session(session);
    }

    return productsToUpdate;
  }

  async create(createMemberDto: CreateMemberDto) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const normalizedMember = this.normalizeMemberData(createMemberDto);
      if (normalizedMember.dni) {
        await this.validateDni(normalizedMember.dni);
      }

      const createdMember = (
        await this.memberRepository.create([normalizedMember], { session })
      )[0];

      const memberFullName = this.getFullName(createdMember);
      const assignedProducts = await this.assignProductsToMemberByEmail(
        normalizedMember.email,
        memberFullName,
        session,
      );

      createdMember.products.push(...assignedProducts);
      await createdMember.save({ session });

      await session.commitTransaction();
      session.endSession();
      return createdMember;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      this.handleDBExceptions(error);
    }
  }

  async bulkCreate(createMemberDtos: CreateMemberDto[]) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const normalizedMembers = createMemberDtos.map(this.normalizeMemberData);

      for (const member of normalizedMembers) {
        if (member.dni) {
          await this.validateDni(member.dni);
        }
      }

      const emails = normalizedMembers.map((member) => member.email);

      const existingMembers = await this.memberRepository.find({
        email: { $in: emails },
      });
      if (existingMembers.length > 0) {
        throw new BadRequestException(
          `Members with emails "${existingMembers.map((member) => member.email).join(', ')}" already exist`,
        );
      }

      const teamNames = normalizedMembers
        .map((member) =>
          member.team ? this.normalizeTeamName(member.team) : undefined,
        )
        .filter((team) => team && team.trim() !== '');

      const uniqueTeamNames = [...new Set(teamNames)];

      const existingTeams = await this.teamRepository.find({
        name: { $in: uniqueTeamNames },
      });
      const teamMap = new Map<string, Schema.Types.ObjectId>();

      existingTeams.forEach((team) => {
        teamMap.set(team.name, team._id);
      });

      const teamsToCreate = uniqueTeamNames
        .filter((teamName) => teamName !== undefined)
        .map((teamName) => ({ name: teamName as string }));

      const newTeams = await this.teamsService.bulkCreate(
        teamsToCreate,
        session,
      );

      if (newTeams && newTeams.length > 0) {
        newTeams.forEach((team) => {
          teamMap.set(team.name, team._id);
        });
      }

      const membersToCreate = normalizedMembers.map((member) => {
        if (member.team) {
          const normalizedTeamName = this.normalizeTeamName(member.team);
          const teamId = teamMap.get(normalizedTeamName);
          if (teamId) {
            member.team = teamId.toString();
          }
        }
        return member;
      });

      const createdMembers = await this.memberRepository.insertMany(
        membersToCreate,
        { session },
      );

      for (const member of createdMembers) {
        const fullName = this.getFullName(member);
        const productsToUpdate = await this.productRepository.find({
          assignedEmail: member.email,
        });

        for (const product of productsToUpdate) {
          product.assignedMember = fullName;
          await product.save({ session });
          await this.productRepository
            .deleteOne({ _id: product._id })
            .session(session);
        }

        member.products.push(...productsToUpdate);
        await member.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      return createdMembers;
    } catch (error) {
      console.log('ERROR EM MEMBERBULK ', error);
      await session.abortTransaction();
      session.endSession();
      if (error instanceof BadRequestException) {
        throw new BadRequestException('Error creating members');
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  async findAll() {
    try {
      const members = await this.memberRepository
        .find()
        .populate('team')
        .collation({ locale: 'es', strength: 1 })
        .sort({ firstName: 1, lastName: 1 });
      return members;
    } catch (error) {
      throw new InternalServerErrorException('Error while fetching members');
    }
  }

  async findById(id: ObjectId) {
    const member = await this.memberRepository.findById(id).populate('team');

    if (!member)
      throw new NotFoundException(`Member with id "${id}" not found`);

    return member;
  }

  async findByEmail(email: string, session?: ClientSession) {
    const member = await this.memberRepository
      .findOne({ email: email })
      .session(session || null);

    if (!member)
      throw new NotFoundException(`Member with email "${email}" not found`);

    return member;
  }

  async findByEmailNotThrowError(email: string) {
    return await this.memberRepository.findOne({ email: email });
  }

  async update(id: ObjectId, updateMemberDto: UpdateMemberDto) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const member = await this.memberRepository.findById(id).session(session);
      if (!member) {
        throw new NotFoundException(`Member with id "${id}" not found`);
      }

      if (
        updateMemberDto.dni !== undefined &&
        updateMemberDto.dni !== member.dni
      ) {
        await this.validateDni(updateMemberDto.dni);
      }

      const oldEmail = member.email.trim().toLowerCase();
      const oldFullName = `${member.firstName.trim()} ${member.lastName.trim()}`;

      if (
        updateMemberDto.personalEmail === null ||
        updateMemberDto.personalEmail === ''
      ) {
        member.personalEmail = undefined;
      } else if (updateMemberDto.personalEmail) {
        member.personalEmail = updateMemberDto.personalEmail.trim();
      }

      Object.assign(member, updateMemberDto);

      if (updateMemberDto.dni === undefined) {
        member.dni = undefined;
      }

      member.email = member.email.trim().toLowerCase();
      member.firstName = member.firstName.trim();
      member.lastName = member.lastName.trim();
      await member.save({ session });

      const emailUpdated = oldEmail !== member.email;
      const fullNameUpdated =
        oldFullName !== `${member.firstName} ${member.lastName}`;

      if (emailUpdated || fullNameUpdated) {
        const updatedProducts = member.products.map((product) => {
          if (
            product.assignedEmail === oldEmail &&
            product.assignedMember === oldFullName
          ) {
            product.assignedEmail = member.email;
            product.assignedMember = `${member.firstName} ${member.lastName}`;
          }
          return product;
        });

        member.products = updatedProducts;
        await member.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      return member;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      this.handleDBExceptions(error);
    }
  }

  async softDeleteMember(id: ObjectId) {
    const member = await this.findById(id);

    if (!member) {
      throw new NotFoundException(`Member with id "${id}" not found`);
    }

    const hasRecoverableProducts = member.products.some(
      (product) => product.recoverable,
    );
    const hasNonRecoverableProducts = member.products.some(
      (product) => !product.recoverable,
    );

    if (hasRecoverableProducts) {
      throw new BadRequestException(
        'Cannot delete a member with recoverable products assigned. Please unassign the products first.',
      );
    }

    if (hasNonRecoverableProducts) {
      member.products.forEach((product) => {
        if (!product.recoverable) {
          product.status = 'Deprecated';
          product.isDeleted = true;
        }
      });
    }

    member.$isDeleted(true);
    await member.save();

    await this.memberRepository.softDelete({ _id: id });

    return {
      message: `Member with id ${id} has been soft deleted`,
    };
  }

  async findProductBySerialNumber(serialNumber: string) {
    if (!serialNumber || serialNumber.trim() === '') {
      return null;
    }
    const member = await this.memberRepository.findOne({
      'products.serialNumber': serialNumber,
    });
    return member
      ? member.products.find((product) => product.serialNumber === serialNumber)
      : null;
  }

  async assignProduct(
    email: string,
    createProductDto: CreateProductDto,
    session?: ClientSession,
  ) {
    const member = await this.findByEmailNotThrowError(email);

    if (member) {
      const { serialNumber, price, ...rest } = createProductDto;

      const productData = {
        ...rest,
        ...(serialNumber && serialNumber.trim() !== '' ? { serialNumber } : {}),
        assignedMember: `${member.firstName} ${member.lastName}`,
        assignedEmail: email,
        ...(price?.amount !== undefined && price?.currencyCode
          ? {
              price: { amount: price.amount, currencyCode: price.currencyCode },
            }
          : {}),
      };

      member.products.push(productData);
      await member.save({ session });
    }

    return member;
  }

  async getAllProductsWithMembers() {
    const members = await this.memberRepository.find();

    return members.flatMap((member) => member.products || []);
  }

  async getProductByMembers(id: ObjectId, session?: ClientSession) {
    const members = await this.memberRepository.find().session(session || null);

    for (const member of members) {
      const products = member.products || [];
      const product = products.find(
        (product) => product._id!.toString() === id.toString(),
      );

      if (product) {
        return { member, product };
      }
    }
  }

  async deleteProductFromMember(
    memberId: ObjectId,
    productId: ObjectId,
    session?: ClientSession,
  ) {
    try {
      const member = await this.memberRepository
        .findById(memberId)
        .session(session || null);

      if (!member) {
        throw new Error(`Member with id ${memberId} not found`);
      }

      member.products = member.products.filter(
        (product) => product?._id?.toString() !== productId.toString(),
      );

      await member.save({ session });
    } catch (error) {
      throw error;
    }
  }

  async findMembersByTeam(teamId: ObjectId) {
    try {
      const members = await this.memberRepository
        .find({ team: teamId })
        .populate('team');
      if (!members || members.length === 0) {
        throw new NotFoundException(
          `Members with team id "${teamId}" not found`,
        );
      }
      return members;
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  private handleDBExceptions(error: any) {
    if (error.code === 11000) {
      const duplicateKey = Object.keys(error.keyPattern)[0];

      if (duplicateKey === 'email') {
        throw new BadRequestException('Email is already in use');
      } else if (duplicateKey === 'dni') {
        throw new BadRequestException('DNI is already in use');
      }
    } else if (error instanceof BadRequestException) {
      throw new BadRequestException(error.message);
    } else {
      throw new InternalServerErrorException(
        'Unexpected error, check server log',
      );
    }
  }
}

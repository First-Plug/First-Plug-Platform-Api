import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ClientSession, Model, ObjectId, Schema } from 'mongoose';
import { MemberDocument, MemberSchema } from './schemas/member.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { CreateProductDto } from 'src/products/dto';
import { Team } from 'src/teams/schemas/team.schema';
import { ProductModel } from 'src/products/products.service';
import { TeamsService } from 'src/teams/teams.service';
import { InjectSlack } from 'nestjs-slack-webhook';
import { IncomingWebhook } from '@slack/webhook';
import { HistoryService } from 'src/history/history.service';
import { TenantConnectionService } from 'src/common/providers/tenant-connection.service';
import { Status } from 'src/products/interfaces/product.interface';
import { ShipmentsService } from 'src/shipments/shipments.service';
import { EventTypes } from 'src/common/events/types';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MemberAddressUpdatedEvent } from 'src/common/events/member-address-update.event';
import { ShipmentSchema } from 'src/shipments/schema/shipment.schema';

interface MemberWithShipmentStatus extends MemberDocument {
  shipmentStatus?: string[];
  hasOnTheWayShipment?: boolean;
}

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
    private readonly teamsService: TeamsService,
    @InjectSlack() private readonly slack: IncomingWebhook,
    private readonly historyService: HistoryService,
    private readonly connectionService: TenantConnectionService,
    @Inject(forwardRef(() => ShipmentsService))
    private readonly shipmentsService: ShipmentsService,
    private eventEmitter: EventEmitter2,
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

  async validateSerialNumber(serialNumber: string, productId: ObjectId) {
    // Validar en la colección completa de members
    const isDuplicateInMembers = await this.memberRepository.exists({
      'products.serialNumber': serialNumber,
      'products._id': { $ne: productId },
    });

    return isDuplicateInMembers;
  }

  async notifyOffBoarding(member: any, products: any, tenantName: string) {
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
              text: `Offboarding: ${tenantName}*`,
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

  private async validateDni(dni: string) {
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

  async create(
    createMemberDto: CreateMemberDto,
    userId: string,
    tenantName: string,
  ) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
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

      await this.historyService.create({
        actionType: 'create',
        itemType: 'members',
        userId: userId,
        changes: {
          oldData: null,
          newData: createdMember,
        },
      });

      return createdMember;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      this.handleDBExceptions(error);
    }
  }

  async bulkCreate(
    createMemberDtos: CreateMemberDto[],
    userId: string,
    tenantName: string,
  ) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
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

      await this.historyService.create({
        actionType: 'bulk-create',
        itemType: 'members',
        userId: userId,
        changes: {
          oldData: null,
          newData: createdMembers,
        },
      });

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

  async findAll(
    tenantName?: string,
  ): Promise<MemberWithShipmentStatus[] | MemberDocument[]> {
    try {
      const members = await this.memberRepository
        .find()
        .populate('team')
        .collation({ locale: 'es', strength: 1 })
        .sort({ firstName: 1, lastName: 1 });

      // Si no se proporciona tenantName, devolver los miembros sin información adicional
      if (!tenantName) {
        return members;
      }

      // Obtener la conexión al tenant para acceder a los shipments
      const connection =
        await this.connectionService.getTenantConnection(tenantName);
      const ShipmentModel =
        connection.models.Shipment ||
        connection.model('Shipment', ShipmentSchema, 'shipments');

      // Procesar cada miembro para agregar información de shipment
      const membersWithShipmentStatus = await Promise.all(
        members.map(async (member) => {
          const memberObj = member.toObject() as MemberWithShipmentStatus;

          // Solo buscar shipments si el miembro tiene activeShipment = true
          if (member.activeShipment) {
            const fullName = `${member.firstName} ${member.lastName}`;

            // Buscar shipments donde el miembro es origen o destino
            const shipments = await ShipmentModel.find({
              $or: [{ origin: fullName }, { destination: fullName }],
              isDeleted: { $ne: true },
            }).select('shipment_status');

            // Agregar el estado del shipment y si se puede editar
            memberObj.shipmentStatus = shipments.map((s) => s.shipment_status);
            memberObj.hasOnTheWayShipment = shipments.some(
              (s) => s.shipment_status === 'On The Way',
            );
          } else {
            memberObj.shipmentStatus = [];
            memberObj.hasOnTheWayShipment = false;
          }

          return memberObj;
        }),
      );

      return membersWithShipmentStatus;
    } catch (error) {
      console.error('Error fetching members with shipment status:', error);
      throw new InternalServerErrorException('Error while fetching members');
    }
  }

  async findById(id: ObjectId, tenantName: string) {
    const member = await this.memberRepository.findById(id).populate('team');

    if (!member)
      throw new NotFoundException(`Member with id "${id}" not found`);

    const response: any = member.toObject();

    if (member.activeShipment) {
      const connection =
        await this.connectionService.getTenantConnection(tenantName);

      const ShipmentModel =
        connection.models.Shipment ||
        connection.model('Shipment', ShipmentSchema, 'shipments');

      const activeShipments = await ShipmentModel.find({
        destination: `${member.firstName} ${member.lastName}`,
        shipment_status: {
          $in: ['In Preparation', 'On Hold - Missing Data', 'On The Way'],
        },
        isDeleted: { $ne: true },
      }).select('origin products shipment_status');

      const incomingProducts = activeShipments.flatMap((shipment) =>
        shipment.products.map((productId) => ({
          productId: productId.toString(),
          origin: shipment.origin,
          destination: `${member.firstName} ${member.lastName}`,
          shipmentStatus: shipment.shipment_status,
        })),
      );

      response.products = response.products.map((product) => {
        const incoming = incomingProducts.find(
          (p) => p.productId === product._id.toString(),
        );

        if (incoming) {
          return {
            ...product,
            origin: incoming.origin,
            shipmentStatus: incoming.shipmentStatus,
          };
        }

        return product;
      });
    }

    return response;
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

  async validateIfMemberCanBeModified(memberEmail: string, tenantName: string) {
    const shipments = await this.shipmentsService.getShipmentsByMember(
      memberEmail,
      tenantName,
    );
    const hasRestrictedStatus = shipments.some(
      (s) => s.shipment_status === 'On The Way',
    );
    if (hasRestrictedStatus) {
      throw new BadRequestException(
        'This member is part of a shipment On The Way and cannot be modified.',
      );
    }
  }

  private isPersonalDataBeingModified(
    original: MemberDocument,
    updateDto: Partial<UpdateMemberDto>,
  ): boolean {
    const sensitiveFields = [
      'address',
      'apartment',
      'city',
      // 'state',
      'zipCode',
      'country',
      'dni',
      'phone',
      'email',
      'personalEmail',
    ];

    return sensitiveFields.some((field) => {
      const originalHasField =
        field in original &&
        original[field] !== undefined &&
        original[field] !== null;
      const originalValue = originalHasField ? original[field] : undefined;

      const fieldExistsInUpdate = field in updateDto;

      if (
        originalHasField &&
        fieldExistsInUpdate &&
        (updateDto[field] === null || updateDto[field] === undefined)
      ) {
        console.log(`🔍 Campo ${field} está siendo eliminado`);
        return true;
      }

      if (!fieldExistsInUpdate) {
        return false;
      }

      const newValue = updateDto[field];
      const hasChanged = originalValue !== newValue;

      if (hasChanged) {
        console.log(
          `🔍 Campo ${field} ha cambiado: ${originalValue} -> ${newValue}`,
        );
      }

      return hasChanged;
    });
  }

  async update(
    id: ObjectId,
    updateMemberDto: UpdateMemberDto,
    userId: string,
    tenantName,
    ourOfficeEmail,
  ) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const session = await connection.startSession();
    session.startTransaction();

    try {
      const member = await this.memberRepository.findById(id).session(session);

      if (!member) {
        throw new NotFoundException(`Member with id "${id}" not found`);
      }

      const initialMember = JSON.parse(JSON.stringify(member));
      console.log('📊 Estado inicial del miembro:', {
        dni: initialMember.dni,
        email: initialMember.email,
      });

      const willModifyPersonalData = this.isPersonalDataBeingModified(
        member,
        updateMemberDto,
      );

      if (willModifyPersonalData) {
        await this.validateIfMemberCanBeModified(member.email, tenantName);
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

      if (updateMemberDto.activeShipment === undefined) {
        updateMemberDto.activeShipment = member.activeShipment;
      }

      Object.assign(member, updateMemberDto);
      console.log(
        '📋 Datos que se están seteando en el miembro:',
        updateMemberDto,
      );

      if ('dni' in updateMemberDto) {
        if (
          updateMemberDto.dni === null ||
          updateMemberDto.dni === '' ||
          updateMemberDto.dni === undefined
        ) {
          member.dni = undefined;
          console.log('🧹 DNI eliminado explícitamente');
        } else {
          member.dni = updateMemberDto.dni;
        }
      }

      // if (updateMemberDto.dni === undefined) {
      //   member.dni = undefined;
      //   console.log('🔄 DNI explícitamente eliminado del miembro');
      // }

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
      const modified = this.hasPersonalDataChanged(initialMember, member);
      console.log('🔍 ¿Datos personales modificados?', modified, {
        initialDni: initialMember.dni,
        currentDni: member.dni,
      });

      if (modified) {
        if (member.activeShipment) {
          console.log('🔔 Emitiendo evento de actualización de dirección');
          this.eventEmitter.emit(
            EventTypes.MEMBER_ADDRESS_UPDATED,
            new MemberAddressUpdatedEvent(
              member.email,
              tenantName,
              {
                address: initialMember.address || '',
                apartment: initialMember.apartment || '',
                city: initialMember.city || '',
                country: initialMember.country || '',
                zipCode: initialMember.zipCode || '',
                phone: initialMember.phone || '',
                email: initialMember.email || '',

                dni:
                  initialMember.dni !== undefined
                    ? initialMember.dni.toString()
                    : '',
                personalEmail: initialMember.personalEmail || '',
              },
              {
                address: member.address || '',
                apartment: member.apartment || '',
                city: member.city || '',
                country: member.country || '',
                zipCode: member.zipCode || '',
                phone: member.phone || '',
                email: member.email || '',
                dni: member.dni !== undefined ? member.dni.toString() : '',
                personalEmail: member.personalEmail || '',
              },
              new Date(),
              userId,
              ourOfficeEmail,
            ),
          );
        } else {
          console.log(
            '🟨 No se emite evento: el miembro no tiene shipments activos',
          );
        }
      }

      await session.commitTransaction();
      session.endSession();

      await this.historyService.create({
        actionType: 'update',
        itemType: 'members',
        userId: userId,
        changes: {
          oldData: initialMember,
          newData: member,
        },
      });

      return member;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      this.handleDBExceptions(error);
    }
  }

  async softDeleteMember(
    id: ObjectId,
    tenantName: string,
    isOffboarding = false,
  ) {
    const connection =
      await this.connectionService.getTenantConnection(tenantName);
    const MemberModel =
      connection.models.Member ||
      connection.model('Member', MemberSchema, 'members');

    const member = await MemberModel.findById(id);

    if (!member) {
      throw new NotFoundException(`Member with id "${id}" not found`);
    }

    if (member.activeShipment && !isOffboarding) {
      throw new BadRequestException(
        'This member has an active shipment. Please complete or cancel the shipment before deleting.',
      );
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

    await (MemberModel as any).softDelete({ _id: id });
    return member;
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

    if (!member) return null;

    const { serialNumber, price, productCondition, fp_shipment, ...rest } =
      createProductDto;

    const location = 'Employee';

    let status: Status = 'Delivered';

    if (fp_shipment) {
      const isComplete = !!(
        member.country &&
        member.city &&
        member.zipCode &&
        member.address &&
        member.email &&
        member.phone &&
        member.dni
      );

      status = isComplete ? 'In Transit' : 'In Transit - Missing Data';
    }

    const productData = {
      ...rest,
      serialNumber: serialNumber?.trim() || undefined,
      productCondition: productCondition || 'Optimal',
      assignedMember: `${member.firstName} ${member.lastName}`,
      assignedEmail: email,
      location,
      status,
      ...(price?.amount !== undefined && price?.currencyCode
        ? { price: { amount: price.amount, currencyCode: price.currencyCode } }
        : {}),
      fp_shipment: !!fp_shipment,
    };

    member.products.push(productData);
    await member.save({ session });

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

  // private comparePersonalData(original: any, updated: any): boolean {
  //   const sensitiveFields = [
  //     'address',
  //     'apartment',
  //     'city',
  //     'zipCode',
  //     'country',
  //     'dni',
  //     'phone',
  //     'email',
  //     'personalEmail',
  //   ];

  //   return sensitiveFields.some((field) => {
  //     const originalValue = original[field];
  //     const updatedValue = updated[field];

  //     const hasChanged = originalValue !== updatedValue;

  //     if (hasChanged) {
  //       console.log(
  //         `🔄 Campo ${field} ha cambiado: ${originalValue} -> ${updatedValue}`,
  //       );
  //     }

  //     return hasChanged;
  //   });
  // }

  private hasPersonalDataChanged(original: any, updated: any): boolean {
    const sensitiveFields = [
      'address',
      'apartment',
      'city',
      'zipCode',
      'country',
      'dni',
      'phone',
      'email',
      'personalEmail',
    ];

    let changed = false;

    sensitiveFields.forEach((field) => {
      const originalHasField =
        field in original && original[field] !== undefined;
      const updatedHasField = field in updated && updated[field] !== undefined;

      if (
        originalHasField !== updatedHasField ||
        original[field] !== updated[field]
      ) {
        console.log(
          `🔄 Campo ${field} ha cambiado: ${original[field]} -> ${updated[field]}`,
        );
        changed = true;
      }
    });

    return changed;
  }
}

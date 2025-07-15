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
import { ClientSession, Connection, Model, ObjectId, Schema } from 'mongoose';
import { MemberDocument, MemberSchema } from './schemas/member.schema';
import { SoftDeleteModel } from 'soft-delete-plugin-mongoose';
import { Team } from 'src/teams/schemas/team.schema';
import { TeamsService } from 'src/teams/teams.service';
import { HistoryService } from 'src/history/history.service';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ShipmentSchema } from 'src/shipments/schema/shipment.schema';
import { AssignmentsService } from 'src/assignments/assignments.service';
import { chunkArray } from './helpers/chunkArray';
import { LogisticsService } from 'src/logistics/logistics.sevice';
import { normalizeKeys } from './helpers/normalizeKeys';

interface MemberWithShipmentStatus extends MemberDocument {
  shipmentStatus?: string[];
  hasOnTheWayShipment?: boolean;
}

export interface MemberModel
  extends Model<MemberDocument>,
    SoftDeleteModel<MemberDocument> {}

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);
  constructor(
    @Inject('MEMBER_MODEL') private memberRepository: MemberModel,
    @Inject('TEAM_MODEL') private teamRepository: Model<Team>,
    private readonly teamsService: TeamsService,
    private readonly historyService: HistoryService,
    private readonly connectionService: TenantConnectionService,
    private eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => AssignmentsService))
    private readonly assignmentsService: AssignmentsService,
    @Inject(forwardRef(() => LogisticsService))
    private readonly logisticsService: LogisticsService,
  ) {}

  async validateSerialNumber(serialNumber: string, productId: ObjectId) {
    const isDuplicateInMembers = await this.memberRepository.exists({
      'products.serialNumber': serialNumber,
      'products._id': { $ne: productId },
    });

    return isDuplicateInMembers;
  }

  private async validateDni(dni: string) {
    const trimmedDni = dni.trim();
    if (!trimmedDni) return;

    const memberWithSameDni = await this.memberRepository.findOne({
      dni: trimmedDni,
    });
    if (memberWithSameDni) {
      throw new BadRequestException(`DNI ${dni} is already in use`);
    }
  }

  private normalizeTeamName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/(?:^|\s|["'([{])\p{L}/gu, (char) => char.toUpperCase());
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

  private async populateTeam(
    memberOrMembers: MemberDocument | MemberDocument[],
  ): Promise<any> {
    if (Array.isArray(memberOrMembers)) {
      return this.memberRepository.populate(memberOrMembers, { path: 'team' });
    } else {
      return this.memberRepository.populate(memberOrMembers, { path: 'team' });
    }
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
      const dni = normalizedMember.dni?.trim();
      if (dni) {
        await this.validateDni(dni);
        normalizedMember.dni = dni;
      } else {
        delete normalizedMember.dni;
      }

      const createdMember = (
        await this.memberRepository.create([normalizedMember], { session })
      )[0];

      const memberFullName = this.getFullName(createdMember);
      const assignedProducts =
        await this.assignmentsService.assignProductsToMemberByEmail(
          normalizedMember.email,
          memberFullName,
          session,
          tenantName,
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

      const populatedMember = await this.populateTeam(createdMember);
      return populatedMember;
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
    await new Promise((resolve) => process.nextTick(resolve));
    session.startTransaction();

    try {
      const normalizedMembers = createMemberDtos.map(this.normalizeMemberData);

      for (const member of normalizedMembers) {
        if (member.dni?.trim()) {
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

      await session.commitTransaction();
      session.endSession();

      const memberChunks = chunkArray(createdMembers, 10);

      for (const chunk of memberChunks) {
        const batchSession = await connection.startSession();
        batchSession.startTransaction();

        try {
          for (const member of chunk) {
            const fullName = this.getFullName(member);
            await this.assignmentsService.assignAndDetachProductsFromPool(
              member,
              fullName,
              batchSession,
              tenantName,
            );
            await member.save({ session: batchSession });
          }

          await batchSession.commitTransaction();
          await batchSession.endSession();
        } catch (error) {
          await batchSession.abortTransaction();
          batchSession.endSession();
          throw error;
        }
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

      const populatedMembers = await this.populateTeam(createdMembers);
      return populatedMembers;
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

      if (!tenantName) {
        return members;
      }

      const connection =
        await this.connectionService.getTenantConnection(tenantName);
      const ShipmentModel =
        connection.models.Shipment ||
        connection.model('Shipment', ShipmentSchema, 'shipments');

      const membersWithShipmentStatus = await Promise.all(
        members.map(async (member) => {
          const memberObj = member.toObject() as MemberWithShipmentStatus;

          if (member.activeShipment) {
            const fullName = `${member.firstName} ${member.lastName}`;

            const shipments = await ShipmentModel.find({
              $or: [{ origin: fullName }, { destination: fullName }],
              isDeleted: { $ne: true },
            }).select('shipment_status');

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

  async findByEmailNotThrowError(
    email: string,
    connection?: Connection,
    session?: ClientSession,
  ) {
    const query = this.memberRepository.findOne({ email: email }, null, {
      connection,
    });

    if (session) query.session(session);
    return await query;
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

      const willModifyPersonalData = this.isPersonalDataBeingModified(
        member,
        updateMemberDto,
      );

      if (willModifyPersonalData) {
        await this.logisticsService.validateIfMemberCanBeModified(
          member.email,
          tenantName,
        );
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

      await member.save({ session });

      const emailUpdated = oldEmail !== member.email;
      const fullNameUpdated =
        oldFullName !== `${member.firstName} ${member.lastName}`;

      if (emailUpdated || fullNameUpdated) {
        await this.assignmentsService.updateProductsMetadataForMember(
          member,
          oldEmail,
          oldFullName,
          session,
        );
      }

      await this.logisticsService.handleAddressUpdateIfShipmentActive(
        initialMember,
        member,
        tenantName,
        userId,
        ourOfficeEmail,
      );

      await session.commitTransaction();
      session.endSession();

      const finalMemberData = member.toObject?.() ?? member;

      const [normalizedOld, normalizedNew] = normalizeKeys(
        initialMember,
        finalMemberData,
      );

      const changedFields = Object.keys(normalizedNew).filter(
        (key) => normalizedOld[key] !== normalizedNew[key],
      );

      if (changedFields.length > 0) {
        const trimmedOld: Record<string, any> = {};
        const trimmedNew: Record<string, any> = {};

        for (const key of changedFields) {
          trimmedOld[key] = normalizedOld[key];
          trimmedNew[key] = normalizedNew[key];
        }

        trimmedOld.firstName = normalizedOld.firstName;
        trimmedOld.lastName = normalizedOld.lastName;
        trimmedOld.email = normalizedOld.email;
        trimmedNew.firstName = normalizedNew.firstName;
        trimmedNew.lastName = normalizedNew.lastName;
        trimmedNew.email = normalizedNew.email;

        await this.historyService.create({
          actionType: 'update',
          itemType: 'members',
          userId: userId,
          changes: {
            oldData: trimmedOld,
            newData: trimmedNew,
          },
        });
      }

      const populatedMember = await this.populateTeam(member);
      console.log('member con team completo:', populatedMember);
      return populatedMember;
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
    session?: ClientSession,
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

    await (MemberModel as any).softDelete({ _id: id }, { session });
    return member;
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

  public handleDBExceptions(error: any) {
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

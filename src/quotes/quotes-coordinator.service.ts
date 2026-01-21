import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { QuotesService } from './quotes.service';
import { SlackService } from '../slack/slack.service';
import { HistoryService } from '../history/history.service';
import { CreateQuoteDto } from './dto';
import { Quote } from './interfaces/quote.interface';
import { TenantConnectionService } from 'src/infra/db/tenant-connection.service';
import { HistorySchema } from 'src/history/schemas/history.schema';
import { CreateQuoteMessageToSlack } from './helpers/create-quote-message-to-slack';
import { WarehousesService } from '../warehouses/warehouses.service';

/**
 * QuotesCoordinatorService - Servicio Transversal
 * Responsabilidad: Coordinación entre QuotesService y servicios auxiliares
 * - Notificaciones a Slack
 * - Auditoría en History
 * - Lógica de negocio compleja
 */
@Injectable()
export class QuotesCoordinatorService {
  private readonly logger = new Logger(QuotesCoordinatorService.name);

  constructor(
    readonly quotesService: QuotesService,
    private readonly slackService: SlackService,
    private readonly historyService: HistoryService,
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /**
   * Procesar Data Wipe Service
   * Si el destino es FP warehouse y solo tiene countryCode,
   * busca automáticamente el warehouse activo de ese país y completa los datos
   */
  private async processDataWipeService(service: any): Promise<void> {
    if (service.serviceCategory !== 'Data Wipe' || !service.assets) {
      return;
    }

    for (const asset of service.assets) {
      if (
        asset.destination &&
        asset.destination.destinationType === 'FP warehouse' &&
        asset.destination.warehouse
      ) {
        const countryCode = asset.destination.warehouse.countryCode;

        // Si solo tiene countryCode, buscar el warehouse activo del país
        if (
          countryCode &&
          !asset.destination.warehouse.warehouseId &&
          !asset.destination.warehouse.warehouseName
        ) {
          try {
            const warehouseData =
              await this.warehousesService.findByCountryCode(countryCode);

            if (warehouseData) {
              // Buscar warehouse activo
              const activeWarehouse = warehouseData.warehouses.find(
                (w: any) => w.isActive && !w.isDeleted,
              );

              if (activeWarehouse) {
                // Completar datos del warehouse
                asset.destination.warehouse.warehouseId =
                  activeWarehouse._id.toString();
                asset.destination.warehouse.warehouseName =
                  activeWarehouse.name || 'FP warehouse';
              } else {
                this.logger.warn(
                  `No active warehouse found for country code ${countryCode}`,
                );
              }
            }
          } catch (error) {
            this.logger.error(
              `Error processing Data Wipe warehouse for country ${countryCode}:`,
              error,
            );
          }
        }
      }
    }
  }

  /**
   * Crear quote con coordinación de servicios
   * 1. Procesar servicios (ej: Data Wipe con warehouse)
   * 2. Crear quote en BD
   * 3. Notificar a Slack (no-blocking)
   * 4. Registrar en History
   */
  async createQuoteWithCoordination(
    createQuoteDto: CreateQuoteDto,
    tenantId: Types.ObjectId,
    tenantName: string,
    userEmail: string,
    userName?: string,
    userId?: string,
  ): Promise<Quote> {
    // 1. Procesar servicios (ej: Data Wipe con warehouse)
    if (createQuoteDto.services && createQuoteDto.services.length > 0) {
      for (const service of createQuoteDto.services) {
        await this.processDataWipeService(service);
      }
    }

    // 2. Crear quote
    const quote = await this.quotesService.create(
      createQuoteDto,
      tenantId,
      tenantName,
      userEmail,
      userName,
    );

    // 3. Notificar a Slack (no-blocking)
    this.notifyQuoteCreatedToSlack(quote).catch((error) => {
      this.logger.error(
        `Error notifying Slack for quote ${quote.requestId}:`,
        error,
      );
    });

    // 4. Registrar en History (no-blocking)
    this.recordQuoteCreationInHistory(
      quote,
      userId || userEmail,
      tenantName,
    ).catch((error) => {
      this.logger.error(
        `Error recording quote creation in history ${quote.requestId}:`,
        error,
      );
    });

    return quote;
  }

  /**
   * Notificar creación de quote a Slack con todos los detalles
   * Usa actionType 'New' por defecto (para creación)
   */
  private async notifyQuoteCreatedToSlack(quote: Quote): Promise<void> {
    const message = CreateQuoteMessageToSlack(quote, 'New');
    await this.slackService.sendQuoteMessage(message);
  }

  /**
   * Notificar cancelación de quote a Slack
   * Usa actionType 'Cancelled' para indicar que la quote fue cancelada
   */
  private async notifyQuoteCancelledToSlack(quote: Quote): Promise<void> {
    const message = CreateQuoteMessageToSlack(quote, 'Cancelled');
    await this.slackService.sendQuoteMessage(message);
  }

  /**
   * Cancelar quote con coordinación
   * 1. Cambiar status a 'Cancelled'
   * 2. Notificar a Slack (no-blocking)
   * 3. Registrar en History (no-blocking)
   */
  async cancelQuoteWithCoordination(
    id: string,
    tenantName: string,
    userEmail: string,
    quote: Quote,
  ): Promise<Quote> {
    // 1. Cambiar status a Cancelled
    const cancelledQuote = await this.quotesService.cancel(id);

    // 2. Notificar a Slack (no-blocking)
    this.notifyQuoteCancelledToSlack(cancelledQuote).catch((error) => {
      this.logger.error(
        `Error notifying Slack for quote cancellation ${id}:`,
        error,
      );
    });

    // 3. Registrar en History (no-blocking)
    this.recordQuoteCancellationInHistory(
      quote,
      cancelledQuote,
      userEmail,
      tenantName,
    ).catch((error) => {
      this.logger.error(
        `Error recording quote cancellation in history ${id}:`,
        error,
      );
    });

    return cancelledQuote;
  }

  /**
   * Registrar creación de quote en History
   * Incluye productos y servicios
   */
  private async recordQuoteCreationInHistory(
    quote: Quote,
    userId: string,
    tenantName: string,
  ): Promise<void> {
    try {
      // Obtener la conexión del tenant
      const connection =
        await this.tenantConnectionService.getTenantConnection(tenantName);
      const HistoryModel = connection.model('History', HistorySchema);

      const newData: any = {
        requestId: quote.requestId,
        tenantName: quote.tenantName,
        userEmail: quote.userEmail,
        userName: quote.userName,
        requestType: quote.requestType,
      };

      // Agregar productos si existen
      if (quote.products && quote.products.length > 0) {
        newData.productCount = quote.products.length;
        newData.totalQuantity = quote.products.reduce(
          (sum, p) => sum + p.quantity,
          0,
        );
        newData.products = quote.products.map((p) =>
          this.formatProductForHistory(p),
        );
      }

      // Agregar servicios si existen
      if (quote.services && quote.services.length > 0) {
        newData.serviceCount = quote.services.length;
        newData.services = quote.services.map((s) =>
          this.formatServiceForHistory(s),
        );
      }

      const historyData = {
        actionType: 'create',
        userId: userId,
        itemType: 'quotes',
        changes: {
          oldData: null,
          newData,
        },
      };

      // Usar el modelo del tenant en lugar del servicio global
      await HistoryModel.create(historyData);
    } catch (error) {
      this.logger.error('Failed to record quote creation in history:', error);
      // No lanzar error, solo loguear
    }
  }

  /**
   * Registrar cancelación de quote en History
   * oldData: Quote con status 'Requested'
   * newData: Quote con status 'Cancelled'
   */
  private async recordQuoteCancellationInHistory(
    oldQuote: Quote,
    newQuote: Quote,
    userId: string,
    tenantName: string,
  ): Promise<void> {
    try {
      // Obtener la conexión del tenant
      const connection =
        await this.tenantConnectionService.getTenantConnection(tenantName);
      const HistoryModel = connection.model('History', HistorySchema);

      // Formatear oldData (quote con status 'Requested')
      const oldData: any = {
        requestId: oldQuote.requestId,
        tenantName: oldQuote.tenantName,
        userEmail: oldQuote.userEmail,
        userName: oldQuote.userName,
        requestType: oldQuote.requestType,
        status: 'Requested',
      };

      // Agregar productos si existen
      if (oldQuote.products && oldQuote.products.length > 0) {
        oldData.productCount = oldQuote.products.length;
        oldData.totalQuantity = oldQuote.products.reduce(
          (sum, p) => sum + p.quantity,
          0,
        );
        oldData.products = oldQuote.products.map((p) =>
          this.formatProductForHistory(p),
        );
      }

      // Agregar servicios si existen
      if (oldQuote.services && oldQuote.services.length > 0) {
        oldData.serviceCount = oldQuote.services.length;
        oldData.services = oldQuote.services.map((s) =>
          this.formatServiceForHistory(s),
        );
      }

      // Formatear newData (quote con status 'Cancelled')
      const newData: any = {
        requestId: newQuote.requestId,
        tenantName: newQuote.tenantName,
        userEmail: newQuote.userEmail,
        userName: newQuote.userName,
        requestType: newQuote.requestType,
        status: 'Cancelled',
      };

      // Agregar productos si existen
      if (newQuote.products && newQuote.products.length > 0) {
        newData.productCount = newQuote.products.length;
        newData.totalQuantity = newQuote.products.reduce(
          (sum, p) => sum + p.quantity,
          0,
        );
        newData.products = newQuote.products.map((p) =>
          this.formatProductForHistory(p),
        );
      }

      // Agregar servicios si existen
      if (newQuote.services && newQuote.services.length > 0) {
        newData.serviceCount = newQuote.services.length;
        newData.services = newQuote.services.map((s) =>
          this.formatServiceForHistory(s),
        );
      }

      const historyData = {
        actionType: 'cancel',
        userId: userId,
        itemType: 'quotes',
        changes: {
          oldData,
          newData,
        },
      };

      // Usar el modelo del tenant en lugar del servicio global
      await HistoryModel.create(historyData);
    } catch (error) {
      this.logger.error(
        'Failed to record quote cancellation in history:',
        error,
      );
      // No lanzar error, solo loguear
    }
  }

  /**
   * Formatear producto para historial - Incluye todos los campos específicos de cada categoría
   */
  private formatProductForHistory(product: any): Record<string, any> {
    const baseFields = {
      category: product.category,
      quantity: product.quantity,
      country: product.country,
      ...(product.city && { city: product.city }),
      ...(product.deliveryDate && { deliveryDate: product.deliveryDate }),
      ...(product.comments && { comments: product.comments }),
      ...(product.otherSpecifications && {
        otherSpecifications: product.otherSpecifications,
      }),
    };

    // Campos específicos por categoría
    switch (product.category) {
      case 'Computer':
        return {
          ...baseFields,
          ...(product.os && { os: product.os }),
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
          ...(product.processor && { processor: product.processor }),
          ...(product.ram && { ram: product.ram }),
          ...(product.storage && { storage: product.storage }),
          ...(product.screenSize && { screenSize: product.screenSize }),
          ...(product.extendedWarranty !== undefined && {
            extendedWarranty: product.extendedWarranty,
          }),
          ...(product.extendedWarrantyYears && {
            extendedWarrantyYears: product.extendedWarrantyYears,
          }),
          ...(product.deviceEnrollment !== undefined && {
            deviceEnrollment: product.deviceEnrollment,
          }),
        };

      case 'Monitor':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
          ...(product.screenSize && { screenSize: product.screenSize }),
          ...(product.screenTechnology && {
            screenTechnology: product.screenTechnology,
          }),
        };

      case 'Audio':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
        };

      case 'Peripherals':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
        };

      case 'Merchandising':
        return {
          ...baseFields,
          ...(product.description && { description: product.description }),
          ...(product.additionalRequirements && {
            additionalRequirements: product.additionalRequirements,
          }),
        };

      case 'Phone':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
        };

      case 'Tablet':
        return {
          ...baseFields,
          ...(product.brand && { brand: product.brand }),
          ...(product.model && { model: product.model }),
          ...(product.screenSize && { screenSize: product.screenSize }),
        };

      case 'Furniture':
        return {
          ...baseFields,
          ...(product.furnitureType && {
            furnitureType: product.furnitureType,
          }),
        };

      case 'Other':
        return {
          ...baseFields,
          ...(product.description && { description: product.description }),
        };

      default:
        return baseFields;
    }
  }

  /**
   * Helper para formatear snapshot de producto
   */
  private formatProductSnapshot(snapshot: any): Record<string, any> {
    return {
      ...(snapshot.category && { category: snapshot.category }),
      ...(snapshot.name && { name: snapshot.name }),
      ...(snapshot.brand && { brand: snapshot.brand }),
      ...(snapshot.model && { model: snapshot.model }),
      ...(snapshot.serialNumber && { serialNumber: snapshot.serialNumber }),
      ...(snapshot.location && { location: snapshot.location }),
      ...(snapshot.assignedTo && { assignedTo: snapshot.assignedTo }),
      ...(snapshot.countryCode && { countryCode: snapshot.countryCode }),
    };
  }

  /**
   * Helper para formatear ubicación (member, office, warehouse)
   */
  private formatLocation(location: any): Record<string, any> {
    return {
      ...(location.memberId && { memberId: location.memberId }),
      ...(location.assignedMember && {
        assignedMember: location.assignedMember,
      }),
      ...(location.assignedEmail && { assignedEmail: location.assignedEmail }),
      ...(location.officeId && { officeId: location.officeId }),
      ...(location.officeName && { officeName: location.officeName }),
      ...(location.warehouseId && { warehouseId: location.warehouseId }),
      ...(location.warehouseName && { warehouseName: location.warehouseName }),
      ...(location.countryCode && { countryCode: location.countryCode }),
    };
  }

  /**
   * Formatear servicio para historial - Incluye todos los campos del servicio
   * Soporta IT Support, Enrollment y Data Wipe
   */
  private formatServiceForHistory(service: any): Record<string, any> {
    // IT Support Service
    if (service.serviceCategory === 'IT Support') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        issues: service.issues,
        description: service.description,
        impactLevel: service.impactLevel,
        ...(service.issueStartDate && {
          issueStartDate: service.issueStartDate,
        }),
      };

      // Agregar snapshot del producto si existe
      if (service.productSnapshot) {
        baseFields['productSnapshot'] = this.formatProductSnapshot(
          service.productSnapshot,
        );
      }

      // Agregar productId si existe
      if (service.productId) {
        baseFields['productId'] = service.productId;
      }

      return baseFields;
    }
    // Enrollment Service
    else if (service.serviceCategory === 'Enrollment') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        deviceCount: service.enrolledDevices?.length || 0,
        ...(service.additionalDetails && {
          additionalDetails: service.additionalDetails,
        }),
      };

      // Agregar snapshots de dispositivos enrollados
      if (service.enrolledDevices && service.enrolledDevices.length > 0) {
        baseFields['enrolledDevices'] = service.enrolledDevices.map(
          (device: any) => this.formatProductSnapshot(device),
        );
      }

      return baseFields;
    }
    // Data Wipe Service
    else if (service.serviceCategory === 'Data Wipe') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        assetCount: service.assets?.length || 0,
        ...(service.additionalDetails && {
          additionalDetails: service.additionalDetails,
        }),
      };

      // Agregar detalles de assets
      if (service.assets && service.assets.length > 0) {
        baseFields['assets'] = service.assets.map((asset: any) => {
          const assetData: Record<string, any> = {};

          // Agregar snapshot del producto
          if (asset.productSnapshot) {
            assetData['productSnapshot'] = this.formatProductSnapshot(
              asset.productSnapshot,
            );
          }

          // Agregar productId si existe
          if (asset.productId) {
            assetData['productId'] = asset.productId;
          }

          // Agregar fecha deseada
          if (asset.desirableDate) {
            assetData['desirableDate'] = asset.desirableDate;
          }

          // Agregar ubicación actual
          if (asset.currentLocation) {
            assetData['currentLocation'] = asset.currentLocation;

            if (asset.currentMember) {
              assetData['currentMember'] = this.formatLocation(
                asset.currentMember,
              );
            } else if (asset.currentOffice) {
              assetData['currentOffice'] = this.formatLocation(
                asset.currentOffice,
              );
            } else if (asset.currentWarehouse) {
              assetData['currentWarehouse'] = this.formatLocation(
                asset.currentWarehouse,
              );
            }
          }

          // Agregar destino
          if (asset.destination) {
            assetData['destination'] = {
              ...(asset.destination.destinationType && {
                destinationType: asset.destination.destinationType,
              }),
            };

            if (asset.destination.member) {
              assetData['destination']['member'] = this.formatLocation(
                asset.destination.member,
              );
            } else if (asset.destination.office) {
              assetData['destination']['office'] = this.formatLocation(
                asset.destination.office,
              );
            } else if (asset.destination.warehouse) {
              assetData['destination']['warehouse'] = this.formatLocation(
                asset.destination.warehouse,
              );
            }
          }

          return assetData;
        });
      }

      return baseFields;
    }
    // Destruction and Recycling Service
    else if (service.serviceCategory === 'Destruction and Recycling') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        productCount: service.products?.length || 0,
        ...(service.requiresCertificate !== undefined && {
          requiresCertificate: service.requiresCertificate,
        }),
        ...(service.comments && { comments: service.comments }),
      };

      // Agregar detalles de productos
      if (service.products && service.products.length > 0) {
        baseFields['products'] = service.products.map((product: any) => {
          const productData: Record<string, any> = {};

          // Agregar snapshot del producto
          if (product.productSnapshot) {
            productData['productSnapshot'] = this.formatProductSnapshot(
              product.productSnapshot,
            );
          }

          // Agregar productId si existe
          if (product.productId) {
            productData['productId'] = product.productId;
          }

          return productData;
        });
      }

      return baseFields;
    }
    // Buyback Service
    else if (service.serviceCategory === 'Buyback') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        productCount: service.products?.length || 0,
        ...(service.additionalInfo && {
          additionalInfo: service.additionalInfo,
        }),
      };

      // Agregar detalles de productos
      if (service.products && service.products.length > 0) {
        baseFields['products'] = service.products.map((product: any) => {
          const productData: Record<string, any> = {};

          // Agregar snapshot del producto
          if (product.productSnapshot) {
            productData['productSnapshot'] = this.formatProductSnapshot(
              product.productSnapshot,
            );
          }

          // Agregar productId si existe
          if (product.productId) {
            productData['productId'] = product.productId;
          }

          // Agregar detalles de buyback si existen
          if (product.buybackDetails) {
            productData['buybackDetails'] = {
              ...(product.buybackDetails.generalFunctionality && {
                generalFunctionality:
                  product.buybackDetails.generalFunctionality,
              }),
              ...(product.buybackDetails.batteryCycles !== undefined && {
                batteryCycles: product.buybackDetails.batteryCycles,
              }),
              ...(product.buybackDetails.aestheticDetails && {
                aestheticDetails: product.buybackDetails.aestheticDetails,
              }),
              ...(product.buybackDetails.hasCharger !== undefined && {
                hasCharger: product.buybackDetails.hasCharger,
              }),
              ...(product.buybackDetails.chargerWorks !== undefined && {
                chargerWorks: product.buybackDetails.chargerWorks,
              }),
              ...(product.buybackDetails.additionalComments && {
                additionalComments: product.buybackDetails.additionalComments,
              }),
            };
          }

          return productData;
        });
      }

      return baseFields;
    }
    // Donate Service
    else if (service.serviceCategory === 'Donate') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        productCount: service.products?.length || 0,
        ...(service.additionalDetails && {
          additionalDetails: service.additionalDetails,
        }),
      };

      // Agregar detalles de productos a donar
      if (service.products && service.products.length > 0) {
        baseFields['products'] = service.products.map((product: any) => {
          const productData: Record<string, any> = {};

          // Agregar snapshot del producto
          if (product.productSnapshot) {
            productData['productSnapshot'] = this.formatProductSnapshot(
              product.productSnapshot,
            );
          }

          // Agregar productId si existe
          if (product.productId) {
            productData['productId'] = product.productId;
          }

          // Agregar needsDataWipe si existe (solo si category es Computer o Other)
          if (
            product.productSnapshot?.category === 'Computer' ||
            product.productSnapshot?.category === 'Other'
          ) {
            if (product.needsDataWipe !== undefined) {
              productData['needsDataWipe'] = product.needsDataWipe;
            }
          }

          // Agregar needsCleaning si existe
          if (product.needsCleaning !== undefined) {
            productData['needsCleaning'] = product.needsCleaning;
          }

          // Agregar comentarios si existen
          if (product.comments) {
            productData['comments'] = product.comments;
          }

          return productData;
        });
      }

      return baseFields;
    }
    // Cleaning Service
    else if (service.serviceCategory === 'Cleaning') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        productCount: service.products?.length || 0,
        ...(service.additionalDetails && {
          additionalDetails: service.additionalDetails,
        }),
      };

      // Agregar detalles de productos a limpiar
      if (service.products && service.products.length > 0) {
        baseFields['products'] = service.products.map((product: any) => {
          const productData: Record<string, any> = {};

          // Agregar snapshot del producto
          if (product.productSnapshot) {
            productData['productSnapshot'] = this.formatProductSnapshot(
              product.productSnapshot,
            );
          }

          // Agregar productId si existe
          if (product.productId) {
            productData['productId'] = product.productId;
          }

          // Agregar fecha deseada si existe
          if (product.desiredDate) {
            productData['desiredDate'] = product.desiredDate;
          }

          // Agregar tipo de limpieza si existe
          if (product.cleaningType) {
            productData['cleaningType'] = product.cleaningType;
          }

          // Agregar comentarios adicionales si existen
          if (product.additionalComments) {
            productData['additionalComments'] = product.additionalComments;
          }

          return productData;
        });
      }

      return baseFields;
    }
    // Storage Service
    else if (service.serviceCategory === 'Storage') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        productCount: service.products?.length || 0,
        ...(service.additionalDetails && {
          additionalDetails: service.additionalDetails,
        }),
      };

      // Agregar detalles de productos a almacenar
      if (service.products && service.products.length > 0) {
        baseFields['products'] = service.products.map((product: any) => {
          const productData: Record<string, any> = {};

          // Agregar snapshot del producto
          if (product.productSnapshot) {
            productData['productSnapshot'] = this.formatProductSnapshot(
              product.productSnapshot,
            );
          }

          // Agregar productId si existe
          if (product.productId) {
            productData['productId'] = product.productId;
          }

          // Agregar tamaño aproximado si existe
          if (product.approximateSize) {
            productData['approximateSize'] = product.approximateSize;
          }

          // Agregar peso aproximado si existe
          if (product.approximateWeight) {
            productData['approximateWeight'] = product.approximateWeight;
          }

          // Agregar días de guardado aproximado si existe
          if (product.approximateStorageDays !== undefined) {
            productData['approximateStorageDays'] =
              product.approximateStorageDays;
          }

          // Agregar comentarios adicionales si existen
          if (product.additionalComments) {
            productData['additionalComments'] = product.additionalComments;
          }

          return productData;
        });
      }

      return baseFields;
    }
    // Offboarding Service
    else if (service.serviceCategory === 'Offboarding') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        isSensitiveSituation: service.isSensitiveSituation,
        employeeKnows: service.employeeKnows,
        productCount: service.products?.length || 0,
        ...(service.desirablePickupDate && {
          desirablePickupDate: service.desirablePickupDate,
        }),
        ...(service.additionalDetails && {
          additionalDetails: service.additionalDetails,
        }),
      };

      // Agregar información del miembro origen
      if (service.originMember) {
        baseFields['originMember'] = {
          memberId: service.originMember.memberId,
          firstName: service.originMember.firstName,
          lastName: service.originMember.lastName,
          email: service.originMember.email,
          countryCode: service.originMember.countryCode,
        };
      }

      // Agregar detalles de productos a offboardear
      if (service.products && service.products.length > 0) {
        baseFields['products'] = service.products.map((product: any) => {
          const productData: Record<string, any> = {};

          // Agregar snapshot del producto
          if (product.productSnapshot) {
            productData['productSnapshot'] = this.formatProductSnapshot(
              product.productSnapshot,
            );
          }

          // Agregar productId si existe
          if (product.productId) {
            productData['productId'] = product.productId;
          }

          // Agregar destino del producto
          if (product.destination) {
            productData['destination'] = {
              type: product.destination.type,
              ...(product.destination.memberId && {
                memberId: product.destination.memberId,
              }),
              ...(product.destination.assignedMember && {
                assignedMember: product.destination.assignedMember,
              }),
              ...(product.destination.assignedEmail && {
                assignedEmail: product.destination.assignedEmail,
              }),
              ...(product.destination.officeId && {
                officeId: product.destination.officeId,
              }),
              ...(product.destination.officeName && {
                officeName: product.destination.officeName,
              }),
              ...(product.destination.warehouseId && {
                warehouseId: product.destination.warehouseId,
              }),
              ...(product.destination.warehouseName && {
                warehouseName: product.destination.warehouseName,
              }),
              countryCode: product.destination.countryCode,
            };
          }

          return productData;
        });
      }

      return baseFields;
    }
    // Logistics Service
    else if (service.serviceCategory === 'Logistics') {
      const baseFields = {
        serviceCategory: service.serviceCategory,
        productCount: service.products?.length || 0,
        ...(service.desirablePickupDate && {
          desirablePickupDate: service.desirablePickupDate,
        }),
        ...(service.additionalDetails && {
          additionalDetails: service.additionalDetails,
        }),
      };

      // Agregar detalles de productos a enviar
      if (service.products && service.products.length > 0) {
        baseFields['products'] = service.products.map((product: any) => {
          const productData: Record<string, any> = {};

          // Agregar snapshot del producto
          if (product.productSnapshot) {
            productData['productSnapshot'] = this.formatProductSnapshot(
              product.productSnapshot,
            );
          }

          // Agregar productId si existe
          if (product.productId) {
            productData['productId'] = product.productId;
          }

          // Agregar destino del producto
          if (product.destination) {
            productData['destination'] = {
              type: product.destination.type,
              ...(product.destination.memberId && {
                memberId: product.destination.memberId,
              }),
              ...(product.destination.assignedMember && {
                assignedMember: product.destination.assignedMember,
              }),
              ...(product.destination.assignedEmail && {
                assignedEmail: product.destination.assignedEmail,
              }),
              ...(product.destination.officeId && {
                officeId: product.destination.officeId,
              }),
              ...(product.destination.officeName && {
                officeName: product.destination.officeName,
              }),
              ...(product.destination.warehouseId && {
                warehouseId: product.destination.warehouseId,
              }),
              ...(product.destination.warehouseName && {
                warehouseName: product.destination.warehouseName,
              }),
              countryCode: product.destination.countryCode,
            };
          }

          return productData;
        });
      }

      return baseFields;
    }

    // Fallback para servicios desconocidos
    return {
      serviceCategory: service.serviceCategory,
    };
  }
}

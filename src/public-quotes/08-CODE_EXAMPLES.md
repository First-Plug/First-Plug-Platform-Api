# 💻 Public Quotes - Ejemplos de Código

## 1. Estructura de Carpetas

```
src/public-quotes/
├── public-quotes.module.ts
├── public-quotes.service.ts
├── public-quotes-coordinator.service.ts
├── public-quotes.controller.ts
├── dto/
│   ├── create-public-quote.dto.ts
│   └── public-quote-response.dto.ts
├── validations/
│   └── create-public-quote.zod.ts
├── helpers/
│   ├── generate-public-quote-number.ts
│   └── create-public-quote-message-to-slack.ts
├── interfaces/
│   └── public-quote.interface.ts
├── ARCHITECTURE_PLAN.md
├── TECHNICAL_DETAILS.md
├── PLAN_SUMMARY.md
├── COMPARISON_QUOTES.md
└── CODE_EXAMPLES.md (este archivo)
```

---

## 2. Servicio Raíz (PublicQuotesService)

```typescript
@Injectable()
export class PublicQuotesService {
  private readonly logger = new Logger(PublicQuotesService.name);

  constructor(private readonly slackService: SlackService) {}

  /**
   * Generar número único para quote pública
   * Formato: PQR-{timestamp}-{random}
   */
  generatePublicQuoteNumber(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PQR-${timestamp}-${random}`;
  }

  /**
   * Preparar payload para Slack
   */
  prepareSlackPayload(quoteNumber: string, data: CreatePublicQuoteDto): any {
    return {
      channel: 'quotes',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Nueva Quote Pública*\n*Número*: ${quoteNumber}`,
          },
        },
        // ... más bloques
      ],
    };
  }
}
```

---

## 3. Coordinador (PublicQuotesCoordinatorService)

```typescript
@Injectable()
export class PublicQuotesCoordinatorService {
  private readonly logger = new Logger(PublicQuotesCoordinatorService.name);

  constructor(
    private readonly publicQuotesService: PublicQuotesService,
    private readonly slackService: SlackService,
  ) {}

  /**
   * Crear quote pública con coordinación
   */
  async createPublicQuoteWithCoordination(
    createDto: CreatePublicQuoteDto,
  ): Promise<PublicQuoteResponseDto> {
    // 1. Generar número
    const quoteNumber = this.publicQuotesService.generatePublicQuoteNumber();

    // 2. Preparar payload
    const slackPayload = this.publicQuotesService.prepareSlackPayload(
      quoteNumber,
      createDto,
    );

    // 3. Enviar a Slack (no-blocking)
    this.slackService.sendQuoteMessage(slackPayload).catch((error) => {
      this.logger.error(`Error enviando a Slack: ${error.message}`);
    });

    // 4. Retornar confirmación
    return {
      message: 'Quote creada exitosamente',
      quoteNumber,
      createdAt: new Date(),
    };
  }
}
```

---

## 4. Controller (PublicQuotesController)

```typescript
@Controller('public-quotes')
export class PublicQuotesController {
  constructor(private readonly coordinator: PublicQuotesCoordinatorService) {}

  /**
   * POST /api/public-quotes/create
   * Sin autenticación, con rate limiting
   */
  @Post('create')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreatePublicQuoteDto,
  ): Promise<PublicQuoteResponseDto> {
    try {
      // Validación Zod
      const validated = CreatePublicQuoteSchema.parse(createDto);

      // Crear quote
      return await this.coordinator.createPublicQuoteWithCoordination(
        validated,
      );
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException(error.errors);
      }
      throw error;
    }
  }
}
```

---

## 5. Validación Zod

```typescript
export const CreatePublicQuoteSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .refine(
      (email) => !email.endsWith('@firstplug.com'),
      'Email de FirstPlug no permitido',
    ),
  fullName: z
    .string()
    .min(2, 'Nombre muy corto')
    .max(100, 'Nombre muy largo')
    .transform((v) => v.trim()),
  companyName: z
    .string()
    .min(2, 'Empresa muy corta')
    .max(100, 'Empresa muy larga')
    .transform((v) => v.trim()),
  country: z.string().min(2, 'País inválido'),
  phone: z.string().optional(),
  requestType: z.enum(['product', 'service', 'mixed'], {
    errorMap: () => ({
      message: 'requestType debe ser: product, service o mixed',
    }),
  }),
  products: z.array(z.object({})).optional(),
  services: z.array(z.object({})).optional(),
});
```

**IMPORTANTE**:

- Validar que si `requestType` es 'product' o 'mixed', `products` no esté vacío
- Validar que si `requestType` es 'service' o 'mixed', `services` no esté vacío
- Validar que NO haya servicios de tipo 'Offboarding'

---

## 6. Módulo (PublicQuotesModule)

```typescript
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    SlackModule,
  ],
  controllers: [PublicQuotesController],
  providers: [PublicQuotesService, PublicQuotesCoordinatorService],
  exports: [PublicQuotesService],
})
export class PublicQuotesModule {}
```

---

## 7. Integración en AppModule

```typescript
@Module({
  imports: [
    // ... otros módulos
    QuotesModule, // Quotes logueadas
    PublicQuotesModule, // Quotes públicas (NUEVO)
  ],
})
export class AppModule {}
```

---

## 8. Validación Zod para Offboarding y Logistics

### Offboarding Service Validation

```typescript
// src/public-quotes/validations/offboarding-service.zod.ts
import { z } from 'zod';

const OffboardingOriginMemberSchema = z.object({
  firstName: z.string().min(1, 'First name es requerido'),
  lastName: z.string().min(1, 'Last name es requerido'),
  email: z.string().email('Email inválido'),
  countryCode: z.string().max(2, 'Country code debe ser un código ISO válido'),
});

const OffboardingDestinationSchema = z.union([
  z.object({
    type: z.literal('Member'),
    memberId: z.string().min(1, 'Member ID es requerido'),
    assignedMember: z.string().min(1, 'Assigned member es requerido'),
    assignedEmail: z.string().email('Email inválido'),
    countryCode: z.string().max(2, 'Country code es requerido'),
  }),
  z.object({
    type: z.literal('Office'),
    officeId: z.string().min(1, 'Office ID es requerido'),
    officeName: z.string().min(1, 'Office name es requerido'),
    countryCode: z.string().max(2, 'Country code es requerido'),
  }),
  z.object({
    type: z.literal('Warehouse'),
    warehouseId: z.string().min(1, 'Warehouse ID es requerido'),
    warehouseName: z.string().min(1, 'Warehouse name es requerido'),
    countryCode: z.string().max(2, 'Country code es requerido'),
  }),
]);

const OffboardingProductSchema = z.object({
  productId: z.string().optional(),
  productSnapshot: z.any().optional(),
  destination: OffboardingDestinationSchema,
});

export const OffboardingServiceSchema = z.object({
  serviceCategory: z.literal('Offboarding'),
  originMember: OffboardingOriginMemberSchema,
  isSensitiveSituation: z.boolean(),
  employeeKnows: z.boolean(),
  products: z
    .array(OffboardingProductSchema)
    .min(1, 'Al menos un producto es requerido'),
  desirablePickupDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
    .optional(),
  additionalDetails: z.string().max(1000, 'Max 1000 caracteres').optional(),
});
```

### Logistics Service Validation

```typescript
// src/public-quotes/validations/logistics-service.zod.ts
import { z } from 'zod';

const LogisticsDestinationSchema = z.union([
  z.object({
    type: z.literal('Member'),
    memberId: z.string().optional(),
    assignedMember: z.string().optional(),
    assignedEmail: z.string().email().optional(),
    countryCode: z.string().max(2, 'Country code es requerido'),
  }),
  z.object({
    type: z.literal('Office'),
    officeId: z.string().optional(),
    officeName: z.string().optional(),
    countryCode: z.string().max(2, 'Country code es requerido'),
  }),
  z.object({
    type: z.literal('Warehouse'),
    warehouseId: z.string().optional(),
    warehouseName: z.string().optional(),
    countryCode: z.string().max(2, 'Country code es requerido'),
  }),
]);

const LogisticsProductSchema = z.object({
  productId: z.string().optional(),
  productSnapshot: z.any().optional(),
  destination: LogisticsDestinationSchema,
});

export const LogisticsServiceSchema = z.object({
  serviceCategory: z.literal('Logistics'),
  products: z
    .array(LogisticsProductSchema)
    .min(1, 'Al menos un producto es requerido'),
  desirablePickupDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD')
    .optional(),
  additionalDetails: z.string().max(1000, 'Max 1000 caracteres').optional(),
});
```

---

## 9. Ejemplo de Request/Response

### Request - Offboarding

```bash
curl -X POST http://localhost:3001/api/public-quotes/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@empresa.com",
    "fullName": "Juan Pérez",
    "companyName": "Empresa XYZ",
    "country": "AR",
    "requestType": "service",
    "services": [{
      "serviceCategory": "Offboarding",
      "originMember": {
        "firstName": "Carlos",
        "lastName": "López",
        "email": "carlos@empresa.com",
        "countryCode": "AR"
      },
      "isSensitiveSituation": false,
      "employeeKnows": true,
      "products": [{
        "destination": {
          "type": "Warehouse",
          "warehouseId": "WH-001",
          "warehouseName": "Warehouse Central",
          "countryCode": "AR"
        }
      }],
      "desirablePickupDate": "2024-02-15"
    }]
  }'
```

### Request - Logistics

```bash
curl -X POST http://localhost:3001/api/public-quotes/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@empresa.com",
    "fullName": "Juan Pérez",
    "companyName": "Empresa XYZ",
    "country": "AR",
    "requestType": "service",
    "services": [{
      "serviceCategory": "Logistics",
      "products": [{
        "destination": {
          "type": "Office",
          "officeId": "OFF-002",
          "officeName": "Oficina Buenos Aires",
          "countryCode": "AR"
        }
      }],
      "desirablePickupDate": "2024-02-20"
    }]
  }'
```

### Response (201)

```json
{
  "message": "Quote creada exitosamente",
  "quoteNumber": "PQR-1705123456789-A7K2",
  "createdAt": "2024-01-13T10:30:00Z"
}
```

---

## 10. Schema para BD Superior (firstPlug.quotes / main.quotes)

### PublicQuote Schema

```typescript
// src/public-quotes/schemas/public-quote.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class PublicQuote {
  _id?: Types.ObjectId;

  // Datos del cliente
  @Prop({ type: String, required: true, index: true })
  email: string;

  @Prop({ type: String, required: true })
  fullName: string;

  @Prop({ type: String, required: true })
  companyName: string;

  @Prop({ type: String, required: true, index: true })
  country: string;

  @Prop({ type: String })
  phone?: string;

  // Solicitud
  @Prop({
    type: String,
    required: true,
    enum: ['product', 'service', 'mixed'],
    index: true,
  })
  requestType: 'product' | 'service' | 'mixed';

  @Prop({ type: Array })
  products?: any[];

  @Prop({ type: Array })
  services?: any[];

  // Metadata
  @Prop({ type: String, required: true, unique: true, index: true })
  quoteNumber: string;

  @Prop({
    type: String,
    enum: ['received', 'reviewed', 'responded'],
    default: 'received',
    index: true,
  })
  status: 'received' | 'reviewed' | 'responded';

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Date, index: true })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const PublicQuoteSchema = SchemaFactory.createForClass(PublicQuote);

// Crear índices
PublicQuoteSchema.index({ createdAt: -1 });
PublicQuoteSchema.index({ email: 1 });
PublicQuoteSchema.index({ country: 1 });
PublicQuoteSchema.index({ requestType: 1 });
PublicQuoteSchema.index({ status: 1 });
PublicQuoteSchema.index({ createdAt: -1, status: 1 });
```

---

## 9. Persistencia en BD Superior

### PublicQuotesService - Método de Guardado

```typescript
@Injectable()
export class PublicQuotesService {
  private readonly logger = new Logger(PublicQuotesService.name);

  constructor(
    @InjectModel(PublicQuote.name)
    private readonly publicQuoteModel: Model<PublicQuote>,
    private readonly slackService: SlackService,
  ) {}

  /**
   * Guardar quote pública en BD superior (firstPlug.quotes en dev / main.quotes en prod)
   */
  async saveToBDSuperior(
    data: CreatePublicQuoteDto,
    quoteNumber: string,
  ): Promise<PublicQuote> {
    try {
      const publicQuote = new this.publicQuoteModel({
        ...data,
        quoteNumber,
        status: 'received',
      });

      const saved = await publicQuote.save();
      this.logger.log(`✅ Public quote saved: ${quoteNumber}`);
      return saved;
    } catch (error) {
      this.logger.error(`❌ Error saving public quote: ${error.message}`);
      throw error;
    }
  }
}
```

### PublicQuotesCoordinatorService - Orquestación

```typescript
@Injectable()
export class PublicQuotesCoordinatorService {
  private readonly logger = new Logger(PublicQuotesCoordinatorService.name);

  constructor(
    private readonly publicQuotesService: PublicQuotesService,
    private readonly slackService: SlackService,
  ) {}

  async createPublicQuoteWithCoordination(
    createDto: CreatePublicQuoteDto,
  ): Promise<PublicQuoteResponseDto> {
    // 1. Generar número
    const quoteNumber = this.publicQuotesService.generatePublicQuoteNumber();

    // 2. Guardar en BD (CRÍTICO)
    try {
      await this.publicQuotesService.saveToFirstPlug(createDto, quoteNumber);
    } catch (error) {
      this.logger.error(`Failed to save to DB: ${error.message}`);
      throw new InternalServerErrorException('Error saving quote');
    }

    // 3. Preparar payload Slack
    const slackPayload = this.publicQuotesService.prepareSlackPayload(
      quoteNumber,
      createDto,
    );

    // 4. Enviar a Slack (no-blocking)
    try {
      await this.slackService.sendQuoteMessage(slackPayload);
    } catch (error) {
      this.logger.warn(`Slack notification failed: ${error.message}`);
      // No throw - quote ya está guardada en BD
    }

    // 5. Retornar confirmación
    return {
      message: 'Quote creada exitosamente',
      quoteNumber,
      createdAt: new Date(),
    };
  }
}
```

---

## 10. SuperAdmin Endpoints

### SuperAdmin Controller

```typescript
@Controller('super-admin/public-quotes')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class PublicQuotesSuperAdminController {
  constructor(
    private readonly publicQuotesSuperAdminService: PublicQuotesSuperAdminService,
  ) {}

  @Get()
  async listPublicQuotes(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
    @Query('country') country?: string,
  ) {
    return this.publicQuotesSuperAdminService.listPublicQuotes({
      page,
      limit,
      status,
      country,
    });
  }

  @Get(':id')
  async getPublicQuote(@Param('id') id: string) {
    return this.publicQuotesSuperAdminService.getPublicQuote(id);
  }

  @Put(':id')
  async updatePublicQuote(
    @Param('id') id: string,
    @Body() updateDto: UpdatePublicQuoteDto,
  ) {
    return this.publicQuotesSuperAdminService.updatePublicQuote(id, updateDto);
  }

  @Delete(':id')
  async deletePublicQuote(@Param('id') id: string) {
    return this.publicQuotesSuperAdminService.deletePublicQuote(id);
  }
}
```

### SuperAdmin Service

```typescript
@Injectable()
export class PublicQuotesSuperAdminService {
  constructor(
    @InjectModel(PublicQuote.name)
    private readonly publicQuoteModel: Model<PublicQuote>,
  ) {}

  async listPublicQuotes(filters: {
    page: number;
    limit: number;
    status?: string;
    country?: string;
  }) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.country) query.country = filters.country;

    const skip = (filters.page - 1) * filters.limit;
    const [data, total] = await Promise.all([
      this.publicQuoteModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit),
      this.publicQuoteModel.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getPublicQuote(id: string) {
    return this.publicQuoteModel.findById(id);
  }

  async updatePublicQuote(id: string, updateDto: UpdatePublicQuoteDto) {
    return this.publicQuoteModel.findByIdAndUpdate(id, updateDto, {
      new: true,
    });
  }

  async deletePublicQuote(id: string) {
    return this.publicQuoteModel.findByIdAndDelete(id);
  }
}
```

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

## 8. Ejemplo de Request/Response

### Request

```bash
curl -X POST http://localhost:3001/api/public-quotes/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@empresa.com",
    "fullName": "Juan Pérez",
    "companyName": "Empresa XYZ",
    "country": "AR",
    "phone": "+54 9 11 1234-5678",
    "products": [
      {
        "category": "Computer",
        "brand": "Dell",
        "model": "XPS 13",
        "quantity": 2
      }
    ]
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

# 🎯 Public Quotes - Decisiones Clave

## 1. ✅ Módulo Aislado (PublicQuotesModule)

### Decisión

Crear módulo separado de `QuotesModule` en lugar de reutilizar.

### Razones

- **Seguridad diferente**: JWT vs Rate Limiting
- **Datos diferentes**: Estructura completamente diferente
- **Numeración diferente**: QR vs PQR
- **Escalabilidad**: Cambios futuros sin afectar quotes logueadas
- **Claridad**: Código más limpio y mantenible

### Alternativa Rechazada

Reutilizar `QuotesModule` con flags condicionales:

- ❌ Acoplamiento innecesario
- ❌ Lógica condicional compleja
- ❌ Difícil de mantener
- ❌ Riesgo de bugs

---

## 2. ✅ Persistencia en BD Superior

### Decisión

Datos **SÍ se guardan** en la colección `quotes` de la BD superior:

- **Desarrollo**: `firstPlug.quotes`
- **Producción**: `main.quotes`

Accesible solo por SuperAdmin.

### Razones

- **Auditoría y Control**: Verificación manual de integridad (contar docs en BD vs mensajes en Slack)
- **Validación**: Asegurar que cada quote que llega a Slack se guardó en BD
- **Preservación de datos**: Mantener registro de todas las solicitudes públicas
- **Escalabilidad**: Base para futuras features (búsqueda, filtrado, conversión, UI SuperAdmin)
- **Nivel superior**: Datos globales en BD superior, no en tenant-specific DBs
- **Fase 1**: Sin UI SuperAdmin - solo persistencia para validación manual

### Estructura

```
MongoDB
├── firstPlug (BD superior - SuperAdmin - DESARROLLO)
│   ├── users
│   ├── tenants
│   ├── warehouses
│   └── quotes ← NUEVA COLECCIÓN (Public Quotes)
│
├── main (BD superior - SuperAdmin - PRODUCCIÓN)
│   ├── users
│   ├── tenants
│   ├── warehouses
│   └── quotes ← NUEVA COLECCIÓN (Public Quotes)
│
└── tenant_* (BD específica de cada tenant)
    └── quotes (Quotes logueadas de ese tenant)
```

### Diferencia Clave

- **Public Quotes**: Guardadas en BD superior (firstPlug.quotes en dev / main.quotes en prod) sin tenantId
- **Authenticated Quotes**: Guardadas en `tenant_*.quotes` (con tenantId)

---

## 3. ✅ Numeración PQR (Con BD)

### Decisión

Formato: `PQR-{timestamp}-{random}`

Ejemplo: `PQR-1705123456789-A7K2`

### Razones

- ✅ Único garantizado
- ✅ Timestamp para ordenamiento
- ✅ Random para evitar predicción
- ✅ Corto y legible
- ✅ No requiere transacciones

### Alternativas Rechazadas

- ❌ UUID: Muy largo
- ❌ Secuencial: Requiere BD
- ❌ Solo timestamp: Puede haber colisiones

---

## 4. ✅ Datos Requeridos

### Decisión

```
✅ Email (validado, no @firstplug.com)
✅ Nombre y Apellido
✅ Nombre de Empresa
✅ País (código ISO)
❌ Teléfono (opcional)
✅ Tipo de Solicitud: 'product' | 'service' | 'mixed'
✅ Productos (si aplica)
✅ Servicios (si aplica)
```

### Productos Disponibles

Computer, Monitor, Audio, Peripherals, Merchandising, Phone, Furniture, Tablet, Other

### Servicios Disponibles

IT Support, Enrollment, Data Wipe, Destruction and Recycling, Buyback, Donate, Cleaning, Storage, Offboarding, Logistics

**NOTA**: Todos los servicios disponibles sin productos pre-cargados

### Razones

- **Email**: Para contactar al cliente (validado, no @firstplug.com)
- **Nombre**: Identificación personal
- **Empresa**: Contexto del pedido
- **País**: Ubicación geográfica (código ISO)
- **Teléfono**: Opcional, mejor contacto
- **requestType**: Distinguir entre producto, servicio o ambos
- **Productos/Servicios**: Mismo esquema que quotes logueadas

---

## 5. ✅ Rate Limiting (10 req/min)

### Decisión

Máximo 10 requests por minuto por IP.

### Razones

- **Previene abuso**: Spam, bots
- **Protege Slack**: No saturar canal
- **Razonable**: 10 quotes/min es mucho para un cliente
- **Por IP**: Identifica origen del ataque

### Implementación

```typescript
@Throttle({ default: { limit: 10, ttl: 60000 } })
```

---

## 6. ✅ Validación Zod

### Decisión

Usar Zod para validación de datos.

### Razones

- **Consistencia**: Mismo patrón que quotes logueadas
- **Type-safe**: Generación automática de DTOs
- **Flexible**: Validaciones condicionales
- **Errores claros**: Mensajes descriptivos

### Validaciones

- Email: Formato válido, no @firstplug.com
- Nombre: 2-100 chars, trim
- Empresa: 2-100 chars, trim
- País: Código ISO o nombre
- Teléfono: Formato internacional (opcional)

---

## 7. ✅ Reutilización de SlackService

### Decisión

Usar `SlackService.sendQuoteMessage()` existente.
pero enviar a otro canal de slack diferente al de las quotes logueadas

### Razones

- **No duplicar código**: Ya existe
- **Consistencia**: Mismo formato que quotes logueadas
- **Mantenibilidad**: Cambios centralizados
- **Webhook configurado**: tengo que crear un nuevo canal y configurarlo. Por que va a llegar a un canal quotes-public para produccion y test-quotes-public para desarrollo

### Implementación

```typescript
await this.slackService.sendQuoteMessage(payload);
```

---

## 8. ✅ Sin Autenticación

### Decisión

Endpoints públicos sin JWT Guard.

### Razones

- **Acceso público**: Clientes potenciales sin cuenta
- **Simplifica flujo**: No requiere login
- **Seguridad por Rate Limiting**: Protección alternativa
- **Datos no sensibles**: Solo información de contacto

### Protecciones

- ✅ Rate limiting
- ✅ Validación Zod
- ✅ Sanitización
- ✅ CORS

---

## 9. ✅ Arquitectura de Servicios

### Decisión

```
Controller → Coordinador → Servicio Raíz + SlackService
```

### Razones

- **Separación de responsabilidades**: Cada capa tiene rol claro
- **Reutilización**: SlackService es independiente
- **Testabilidad**: Fácil de mockear
- **Escalabilidad**: Agregar lógica sin afectar otras capas

### Capas

- **Controller**: Recibe requests, valida, delega
- **Coordinador**: Orquesta flujo, maneja errores
- **Servicio Raíz**: Lógica core (generar PQR, preparar payload)
- **SlackService**: Envía notificaciones

---

## 10. ✅ No Exponer Datos Sensibles

### Decisión

Respuesta mínima, sin IDs internos.

### Razones

- **Seguridad**: No revelar estructura interna
- **Privacidad**: No exponer datos de otros clientes
- **Simpleza**: Cliente solo necesita confirmación

### Response

```json
{
  "message": "Quote creada exitosamente",
  "quoteNumber": "PQR-...",
  "createdAt": "2024-01-13T10:30:00Z"
}
```

---

## 11. ✅ Acceso SuperAdmin a Public Quotes

### Decisión

Solo SuperAdmin puede ver/acceder a las public quotes guardadas en BD superior (firstPlug.quotes en dev / main.quotes en prod).
En la primera fase, esto no va a suceder, vamos a ver que pasa cuando integremos odoo

### Razones

- **Seguridad**: Datos públicos pero no para cualquiera
- **Control**: SuperAdmin gestiona todas las solicitudes
- **Auditoría**: Registro centralizado de oportunidades
- **Escalabilidad**: Base para CRM, análisis, conversión

### Implementación - FUTURAS FASES - No en Fase 1

```typescript
// SuperAdmin puede:
- GET /super-admin/public-quotes (listar todas)
- GET /super-admin/public-quotes/:id (ver detalle)
- PUT /super-admin/public-quotes/:id (actualizar estado)
- DELETE /super-admin/public-quotes/:id (archivar)

// Requiere:
- JWT con rol 'superadmin'
- Acceso a BD firstPlug
```

### Campos Adicionales en BD

```typescript
{
  // Datos del cliente
  email: string;
  fullName: string;
  companyName: string;
  country: string;
  phone?: string;

  // Solicitud
  requestType: 'product' | 'service' | 'mixed';
  products?: ProductData[];
  services?: ServiceData[];

  // Metadata SuperAdmin
  quoteNumber: string;        // PQR-{timestamp}-{random}
  status: 'received' | 'reviewed' | 'responded'; // Para tracking
  notes?: string;             // Notas del super admin
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 📋 Resumen de Decisiones

| Decisión      | Opción            | Razón                        |
| ------------- | ----------------- | ---------------------------- |
| Módulo        | Aislado           | Flujos diferentes            |
| Persistencia  | Sí (BD superior)  | Preservación de datos        |
| Numeración    | PQR-{ts}-{random} | Único sin BD                 |
| Rate Limit    | 10/min            | Previene abuso               |
| Validación    | Zod               | Consistencia                 |
| Slack         | Reutilizar        | No duplicar                  |
| Autenticación | No (público)      | Acceso público               |
| Arquitectura  | Coordinador       | Separación responsabilidades |
| Datos         | Mínimos (público) | Seguridad                    |
| SuperAdmin    | Acceso completo   | Gestión centralizada         |

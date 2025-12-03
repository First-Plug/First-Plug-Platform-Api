# 🏗️ 11 - Arquitectura Multi-Tenant - Feature Quotes

## 🎯 Estructura de Datos

Las quotes se guardan en una **colección dentro de cada tenant**, no en una colección global.

---

## 📊 Estructura de Bases de Datos

```
MongoDB
├── firstplug_global (BD Global)
│   ├── global_products
│   ├── users
│   └── tenants
│
└── tenant_<tenantId> (BD del Tenant)
    ├── offices
    ├── products
    ├── shipments
    ├── members
    └── quotes ✅ NUEVA COLECCIÓN
```

---

## 🔑 Cómo Acceder a Quotes

### Usando TenantConnectionService

```typescript
// En el controller o service
const tenantConnection = await this.tenantConnectionService.getTenantConnection(tenantId);
const quotesModel = tenantConnection.model('Quote', QuoteSchema);

// Crear quote
const quote = await quotesModel.create(createQuoteDto);

// Listar quotes del usuario
const quotes = await quotesModel.find({ userEmail: userEmail });

// Obtener quote específico
const quote = await quotesModel.findById(quoteId);
```

---

## ✅ Ventajas de Esta Arquitectura

1. **Aislamiento de datos**: Cada tenant tiene sus propias quotes
2. **Escalabilidad**: Fácil agregar nuevos tenants
3. **Seguridad**: No hay riesgo de filtración entre tenants
4. **Performance**: Queries más rápidas (menos documentos)
5. **Consistencia**: No necesita filtrado por tenantId

---

## ❌ NO Hacer

```typescript
// ❌ INCORRECTO - No filtrar por tenantId
const quotes = await Quote.find({ tenantId: tenantId });

// ❌ INCORRECTO - No usar colección global
const quotes = await globalDb.collection('quotes').find({});
```

---

## ✅ Hacer

```typescript
// ✅ CORRECTO - Usar tenantConnection
const tenantConnection = await this.tenantConnectionService.getTenantConnection(tenantId);
const quotesModel = tenantConnection.model('Quote', QuoteSchema);
const quotes = await quotesModel.find({ userEmail: userEmail });
```

---

## 📝 Generación de RequestID

El `requestID` debe ser secuencial por tenant:

```typescript
// Formato: QR-2025-001, QR-2025-002, etc.
// Usar contador en la BD del tenant

const lastQuote = await quotesModel
  .findOne()
  .sort({ createdAt: -1 });

const lastNumber = lastQuote?.requestID?.split('-')[2] || '0';
const nextNumber = String(parseInt(lastNumber) + 1).padStart(3, '0');
const requestID = `QR-${new Date().getFullYear()}-${nextNumber}`;
```

---

## 🔐 Seguridad

- El usuario solo ve sus propias quotes (filtrar por `userEmail`)
- No hay acceso a quotes de otros usuarios del mismo tenant
- No hay acceso a quotes de otros tenants
- Usar `isDeleted` para soft delete (no eliminar físicamente)

---

## 📚 Referencias

- Ver `TenantConnectionService` en el codebase
- Ver cómo se usa en `ShipmentsService`
- Ver cómo se usa en `ProductsService`


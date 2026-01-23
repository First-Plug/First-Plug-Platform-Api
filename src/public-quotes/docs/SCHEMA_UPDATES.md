# 📋 Actualizaciones de Esquema - Public Quotes

## 🔄 Cambios Realizados

Se ha actualizado toda la documentación para reflejar el esquema real de quotes existente.

---

## 📊 Datos Requeridos (Actualizado)

### Campos del DTO

```
✅ email (validado, no @firstplug.com)
✅ fullName (2-100 chars, trim)
✅ companyName (2-100 chars, trim)
✅ country (código ISO: AR, BR, US, etc.)
❌ phone (opcional)
✅ requestType ('product' | 'service' | 'mixed')
✅ products (array, si requestType incluye 'product')
✅ services (array, si requestType incluye 'service', incluyendo Offboarding y Logistics)
```

---

## 🏷️ requestType

### Valores Permitidos

- **'product'**: Solo productos, services vacío
- **'service'**: Solo servicios, products vacío
- **'mixed'**: Productos y servicios

### Validaciones

- Si requestType es 'product' o 'mixed' → products NO vacío
- Si requestType es 'service' o 'mixed' → services NO vacío
- Permitir todos los serviceCategory: IT Support, Enrollment, Data Wipe, Destruction, Buyback, Donate, Cleaning, Storage, Offboarding, Logistics

---

## 📦 Productos Disponibles

Todos los productos del esquema Quote:

- Computer
- Monitor
- Audio
- Peripherals
- Merchandising
- Phone
- Furniture
- Tablet
- Other

---

## 🔧 Servicios Disponibles

10 servicios (incluyendo Offboarding y Logistics):

- IT Support
- Enrollment
- Data Wipe
- Destruction and Recycling
- Buyback
- Donate
- Cleaning
- Storage
- Offboarding
- Logistics

### 📝 Nota Importante

- **Offboarding**: Ahora disponible para quotes públicas (sin productos pre-cargados)
- **Logistics**: Nuevo servicio para cotización de envíos
- Ambos servicios se especifican en la solicitud sin datos pre-cargados

---

## 📝 Archivos Actualizados

1. **01-README.md** - Características y endpoint
2. **02-EXECUTIVE_SUMMARY.md** - Tabla de características
3. **03-PLAN_SUMMARY.md** - Datos requeridos
4. **04-KEY_DECISIONS.md** - Decisión #4 (Datos)
5. **06-TECHNICAL_DETAILS.md** - Estructura de datos
6. **07-COMPARISON_QUOTES.md** - Tabla comparativa
7. **08-CODE_EXAMPLES.md** - Validación Zod
8. **09-IMPLEMENTATION_ROADMAP.md** - Fase 2 y Fase 7

---

## 🔐 Seguridad Crítica

### Validaciones Obligatorias

- ✅ Email válido y no @firstplug.com
- ✅ requestType válido ('product' | 'service' | 'mixed')
- ✅ Permitir todos los serviceCategory (incluyendo Offboarding y Logistics)
- ✅ Validar que products/services no estén vacíos según requestType
- ✅ Rate limiting: 10 req/min por IP
- ✅ Sanitización: trim, validación de longitud
- ✅ Validar estructura de datos para Offboarding y Logistics

---

## 📚 Referencia

Ver esquema original en:

- `src/quotes/schemas/quote.schema.ts` - Quote schema
- `src/quotes/schemas/service.schema.ts` - Service schemas

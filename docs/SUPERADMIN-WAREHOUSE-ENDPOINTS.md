# 📦 SuperAdmin - Warehouse Management Endpoints

## � Resumen Ejecutivo

Este documento describe los endpoints para gestionar warehouses desde el panel de SuperAdmin.

**Endpoints Principales:**

1. **`PATCH /superadmin/warehouses/:country/:warehouseId/data`** - Actualizar datos del warehouse (nombre, dirección, contacto, etc.)
2. **`PATCH /superadmin/warehouses/:country/:warehouseId/toggle-active`** - Activar/Desactivar warehouse (requiere confirmación)
3. **`GET /superadmin/warehouses/:country`** - Obtener warehouses de un país
4. **`GET /superadmin/warehouses`** - Obtener todos los warehouses

**Reglas Clave:**

- ✅ Solo 1 warehouse activo por país
- ✅ El campo `country` NO es editable
- ✅ Campos requeridos para activación: `name`, `address`, `city`, `state`, `zipCode`
- ✅ Activación automática si se completa el primer warehouse del país
- ✅ Migración automática de productos al cambiar warehouse activo

---

## �📋 Índice

- [Resumen Ejecutivo](#-resumen-ejecutivo)
- [Esquema de Warehouse](#esquema-de-warehouse)
- [Reglas de Negocio](#reglas-de-negocio)
- [Endpoints](#endpoints)
  - [1. Actualizar Warehouse (Datos Generales)](#1-actualizar-warehouse-datos-generales)
  - [2. Toggle Estado de Activación](#2-toggle-estado-de-activación-activardesactivar)
  - [3. Obtener Warehouses por País](#3-obtener-warehouses-por-país)
  - [4. Obtener Todos los Warehouses](#4-obtener-todos-los-warehouses)
- [Flujo Recomendado para el Frontend](#-flujo-recomendado-para-el-frontend)
- [Notas Adicionales](#-notas-adicionales)

---

## 📦 Esquema de Warehouse

### Estructura del Documento Principal (por País)

```typescript
{
  _id: ObjectId,
  country: string,              // Nombre del país (ej: "Argentina")
  countryCode: string,          // Código ISO (ej: "AR")
  hasActiveWarehouse: boolean,  // Campo computado automáticamente
  warehouses: WarehouseItem[],  // Array de warehouses del país
  createdAt: Date,
  updatedAt: Date
}
```

### Estructura de WarehouseItem (Subdocumento)

```typescript
{
  _id: ObjectId,

  // DATOS REQUERIDOS PARA ACTIVACIÓN
  name: string,                 // Nombre del warehouse
  address: string,              // Dirección completa
  city: string,                 // Ciudad
  state: string,                // Estado/Provincia
  zipCode: string,              // Código postal

  // DATOS OPCIONALES
  apartment?: string,           // Apartamento/Piso
  email?: string,               // Email de contacto
  phone?: string,               // Teléfono de contacto
  contactPerson?: string,       // Persona de contacto
  additionalInfo?: string,      // Información adicional

  // CONFIGURACIÓN
  canal: string,                // Canal de comunicación: 'whatsapp' | 'slack' | 'mail' | 'phone'
  partnerType: string,          // Tipo: 'partner' | 'own' | 'temporary' | 'default'

  // ESTADO
  isActive: boolean,            // Si es el warehouse activo del país
  isDeleted: boolean,           // Soft delete
  deletedAt?: Date,

  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔒 Reglas de Negocio

### 1. Warehouse Activo

- **Solo puede haber 1 warehouse activo por país**
- Para que un warehouse pueda ser activo debe cumplir:
  - `hasActiveWarehouse = true` (campo computado)
  - `isActive = true`
  - `isDeleted = false`
  - Tener todos los campos requeridos completos

### 2. Campos Requeridos para Activación

Un warehouse solo puede activarse si tiene estos campos completos:

- `name`
- `address`
- `city`
- `state`
- `zipCode`

### 3. Campo Country (NO EDITABLE)

- ⚠️ **El campo `country` NO se puede actualizar**
- El país está definido en la URL del endpoint
- Si se necesita cambiar el país, se debe crear un nuevo warehouse

### 4. Activación Automática

- Si un warehouse se completa y no hay otro activo en el país, se activa automáticamente
- Si se activa un warehouse, todos los demás del mismo país se desactivan automáticamente

### 5. Desactivación

- Si se desactiva el único warehouse activo, el país quedará sin warehouse activo
- Los productos no podrán asignarse a "FP warehouse" hasta que haya un warehouse activo

---

## 🔌 Endpoints

### 1. Actualizar Warehouse (Datos Generales)

Actualiza los datos de un warehouse específico (dirección, teléfono, email, tipo de partner, etc.) **SIN cambiar el estado de activación**.

**⚠️ IMPORTANTE:** Este endpoint NO permite cambiar `isActive`. Para cambiar el estado de activación, usar el endpoint dedicado `/toggle-active`.

**Endpoint:**

```
PATCH /superadmin/warehouses/:country/:warehouseId/data
```

**Headers:**

```json
{
  "Authorization": "Bearer <superadmin_token>",
  "Content-Type": "application/json"
}
```

**Path Parameters:**

- `country` (string, required): Nombre del país (ej: "Argentina", "Brazil")
- `warehouseId` (string, required): ID del warehouse (ObjectId)

**Body (UpdateWarehouseDataDto):**
Todos los campos son opcionales. Solo envía los que quieres actualizar.

```typescript
{
  // DATOS DE UBICACIÓN
  name?: string,              // Max 100 caracteres
  address?: string,           // Max 200 caracteres
  apartment?: string,         // Max 100 caracteres
  city?: string,              // Max 50 caracteres
  state?: string,             // Max 50 caracteres
  zipCode?: string,           // Max 20 caracteres

  // DATOS DE CONTACTO
  email?: string,             // Debe ser email válido
  phone?: string,
  contactPerson?: string,     // Max 100 caracteres

  // CONFIGURACIÓN
  canal?: string,             // 'whatsapp' | 'slack' | 'mail' | 'phone'
  partnerType?: string,       // 'partner' | 'own' | 'temporary' | 'default'
  additionalInfo?: string     // Max 500 caracteres
}
```

**⚠️ Notas Importantes:**

- Este endpoint NO acepta el campo `isActive` (usar `/toggle-active` para eso)
- **NO incluyas el campo `country` en el body** (no es editable)
- Si el warehouse se completa con esta actualización y no hay otro activo, se activará automáticamente
- Si el warehouse se vuelve incompleto y estaba activo, se desactivará y se buscará otro para activar

**Ejemplo de Request:**

```bash
PATCH /superadmin/warehouses/Argentina/507f1f77bcf86cd799439011/data
Content-Type: application/json

{
  "name": "Warehouse Buenos Aires Central",
  "address": "Av. Corrientes 1234",
  "apartment": "Piso 5",
  "city": "Buenos Aires",
  "state": "CABA",
  "zipCode": "C1043",
  "email": "warehouse.ba@firstplug.com",
  "phone": "+54 11 1234-5678",
  "contactPerson": "Juan Pérez",
  "canal": "whatsapp",
  "partnerType": "partner",
  "additionalInfo": "Horario: Lunes a Viernes 9-18hs"
}
```

**Response 200 OK:**

```json
{
  "warehouse": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Warehouse Buenos Aires Central",
    "address": "Av. Corrientes 1234",
    "apartment": "Piso 5",
    "city": "Buenos Aires",
    "state": "CABA",
    "zipCode": "C1043",
    "email": "warehouse.ba@firstplug.com",
    "phone": "+54 11 1234-5678",
    "contactPerson": "Juan Pérez",
    "canal": "whatsapp",
    "partnerType": "partner",
    "isActive": false,
    "isDeleted": false,
    "additionalInfo": "Horario: Lunes a Viernes 9-18hs",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  },
  "message": "Warehouse updated successfully in Argentina"
}
```

**Response 200 OK (Auto-activado):**

```json
{
  "warehouse": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Warehouse Buenos Aires Central",
    "address": "Av. Corrientes 1234",
    "city": "Buenos Aires",
    "state": "CABA",
    "zipCode": "C1043",
    "isActive": true,
    "isDeleted": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  },
  "autoActivated": true,
  "message": "Warehouse updated and auto-activated in Argentina"
}
```

**Response 404 Not Found:**

```json
{
  "statusCode": 404,
  "message": "Warehouse 507f1f77bcf86cd799439011 not found in Argentina",
  "error": "Not Found"
}
```

---

### 2. Toggle Estado de Activación (Activar/Desactivar)

Endpoint dedicado para cambiar el estado de activación de un warehouse. **Este es el endpoint recomendado** para cambiar `isActive`.

**⚠️ IMPORTANTE:** El frontend debe mostrar un modal de confirmación antes de llamar a este endpoint, especialmente al activar, ya que desactivará otros warehouses del país.

**Endpoint:**

```
PATCH /superadmin/warehouses/:country/:warehouseId/toggle-active
```

**Headers:**

```json
{
  "Authorization": "Bearer <superadmin_token>",
  "Content-Type": "application/json"
}
```

**Path Parameters:**

- `country` (string, required): Nombre del país
- `warehouseId` (string, required): ID del warehouse

**Body (ToggleWarehouseActiveDto):**

```typescript
{
  isActive: boolean; // true para activar, false para desactivar
}
```

**⚠️ Validaciones:**

- Para activar (`isActive: true`):
  - El warehouse debe estar completo (name, address, city, state, zipCode)
  - Automáticamente desactiva otros warehouses del mismo país
  - Retorna información del warehouse activado para que un servicio transversal maneje la migración de productos
- Para desactivar (`isActive: false`):
  - Busca automáticamente otro warehouse completo para activar
  - Si no encuentra otro, el país quedará sin warehouse activo

**Ejemplo de Request (Activar):**

```bash
PATCH /superadmin/warehouses/Argentina/507f1f77bcf86cd799439011/toggle-active
Content-Type: application/json

{
  "isActive": true
}
```

**Response 200 OK (Activación Exitosa):**

```json
{
  "success": true,
  "message": "Warehouse activated successfully in Argentina",
  "warehouse": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Warehouse Buenos Aires Central",
    "address": "Av. Corrientes 1234",
    "city": "Buenos Aires",
    "state": "CABA",
    "zipCode": "C1043",
    "isActive": true,
    "isDeleted": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  },
  "deactivatedWarehouses": ["Warehouse Buenos Aires Norte"],
  "countryCode": "AR",
  "warehouseId": "507f1f77bcf86cd799439011",
  "warehouseName": "Warehouse Buenos Aires Central"
}
```

**Nota:** Los campos `countryCode`, `warehouseId` y `warehouseName` se retornan para que un servicio transversal (como `ProductWarehouseMigrationService`) pueda manejar la migración de productos.

**Response 200 OK (Ya tiene ese estado):**

```json
{
  "success": false,
  "message": "Warehouse is already active",
  "warehouse": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Warehouse Buenos Aires Central",
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  }
}
```

**Response 200 OK (Desactivación con Warning):**

```json
{
  "success": true,
  "message": "Warehouse deactivated successfully in Argentina",
  "warehouse": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Warehouse Buenos Aires Central",
    "isActive": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  },
  "warning": "Warning: Argentina now has no active warehouses. Products cannot be assigned to FP warehouse until a warehouse is activated."
}
```

**Response 400 Bad Request (Incompleto):**

```json
{
  "statusCode": 400,
  "message": "Cannot activate incomplete warehouse. Missing required fields: city, state, zipCode",
  "error": "Bad Request"
}
```

---

### 3. Obtener Warehouses por País

Obtiene todos los warehouses de un país específico (incluyendo inactivos y eliminados).

**Endpoint:**

```
GET /superadmin/warehouses/:country
```

**Headers:**

```json
{
  "Authorization": "Bearer <superadmin_token>"
}
```

**Path Parameters:**

- `country` (string, required): Nombre del país

**Ejemplo de Request:**

```bash
GET /superadmin/warehouses/Argentina
```

**Response 200 OK:**

```json
{
  "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
  "country": "Argentina",
  "countryCode": "AR",
  "hasActiveWarehouse": true,
  "warehouses": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Warehouse Buenos Aires Central",
      "address": "Av. Corrientes 1234",
      "city": "Buenos Aires",
      "state": "CABA",
      "zipCode": "C1043",
      "email": "warehouse.ba@firstplug.com",
      "phone": "+54 11 1234-5678",
      "isActive": true,
      "isDeleted": false,
      "partnerType": "partner",
      "canal": "whatsapp",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-20T15:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Warehouse Córdoba",
      "address": "Av. Colón 5678",
      "city": "Córdoba",
      "state": "Córdoba",
      "zipCode": "X5000",
      "isActive": false,
      "isDeleted": false,
      "partnerType": "temporary",
      "canal": "mail",
      "createdAt": "2024-01-10T10:00:00.000Z",
      "updatedAt": "2024-01-10T10:00:00.000Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-20T15:30:00.000Z"
}
```

---

### 4. Obtener Todos los Warehouses

Obtiene todos los países con sus warehouses.

**Endpoint:**

```
GET /superadmin/warehouses
```

**Headers:**

```json
{
  "Authorization": "Bearer <superadmin_token>"
}
```

**Ejemplo de Request:**

```bash
GET /superadmin/warehouses
```

**Response 200 OK:**

```json
[
  {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "country": "Argentina",
    "countryCode": "AR",
    "hasActiveWarehouse": true,
    "warehouses": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  },
  {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
    "country": "Brazil",
    "countryCode": "BR",
    "hasActiveWarehouse": false,
    "warehouses": [...],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

---

## 🎯 Flujo Recomendado para el Frontend

### Caso 1: Editar Datos del Warehouse

```
1. Usuario edita campos (nombre, dirección, email, etc.)
2. Frontend envía PATCH /superadmin/warehouses/:country/:warehouseId/data
3. Backend valida y actualiza
4. Si el warehouse se completa y no hay otro activo, se activa automáticamente
5. Frontend muestra mensaje de éxito
6. Si response.autoActivated === true, mostrar notificación especial:
   "✅ Warehouse actualizado y activado automáticamente"
```

### Caso 2: Cambiar Estado de Activación (Toggle)

```
1. Usuario hace toggle en el switch de "Active"
2. Frontend muestra modal de confirmación:

   SI ACTIVAR (isActive: true):
   "⚠️ ¿Estás seguro de activar este warehouse?

    Esto causará:
    • Desactivación de otros warehouses activos en [País]
    • Migración automática de productos al nuevo warehouse

    ¿Deseas continuar?"

   SI DESACTIVAR (isActive: false):
   "⚠️ ¿Estás seguro de desactivar este warehouse?

    El sistema buscará automáticamente otro warehouse completo para activar.
    Si no hay otro disponible, el país quedará sin warehouse activo.

    ¿Deseas continuar?"

3. Si confirma:
   - Frontend envía PATCH /superadmin/warehouses/:country/:warehouseId/toggle-active
     Body: { "isActive": true/false }

4. Backend valida, activa/desactiva y retorna resultado

5. Frontend procesa respuesta:
   - Si success === true:
     * Actualizar UI con nuevo estado
     * Mostrar mensaje de éxito
     * Si hay deactivatedWarehouses, mostrar lista
     * Si hay migratedProducts, mostrar cantidad
     * Si hay warning, mostrar alerta amarilla
   - Si success === false:
     * Mostrar mensaje informativo (ya tenía ese estado)
```

### Caso 3: Validación de Campos Requeridos

```
1. Frontend valida en tiempo real si el warehouse está completo
2. Campos requeridos: name, address, city, state, zipCode
3. Función de validación:

   function isWarehouseComplete(warehouse) {
     const required = ['name', 'address', 'city', 'state', 'zipCode'];
     return required.every(field =>
       warehouse[field] && warehouse[field].trim() !== ''
     );
   }

4. Si falta alguno:
   - Deshabilitar el switch de "Active"
   - Mostrar tooltip: "Complete los campos requeridos para activar: [campos faltantes]"
   - Marcar campos faltantes en rojo

5. Si está completo:
   - Habilitar el switch de "Active"
   - Mostrar indicador verde: "✓ Warehouse completo"
```

### Caso 4: Manejo de Errores

```
1. Error 400 (Warehouse Incompleto):
   - Parsear mensaje para obtener campos faltantes
   - Mostrar alerta: "No se puede activar. Faltan campos: [lista]"
   - Enfocar primer campo faltante

2. Error 404 (Warehouse No Encontrado):
   - Mostrar alerta: "Warehouse no encontrado"
   - Recargar lista de warehouses

3. Error 401/403 (No Autorizado):
   - Redirigir a login
   - Mostrar mensaje: "Sesión expirada"
```

---

## 📝 Notas Adicionales

### Valores por Defecto

- `canal`: 'whatsapp'
- `partnerType`: 'default'
- `isActive`: false
- `isDeleted`: false

### Enums Disponibles

```typescript
COMMUNICATION_CHANNELS = ['whatsapp', 'slack', 'mail', 'phone'];
PARTNER_TYPES = ['partner', 'own', 'temporary', 'default'];
```

### Prioridad de Partner Types (para auto-activación)

1. `partner` - Warehouse de partner externo
2. `own` - Warehouse propio de FirstPlug
3. `temporary` - Warehouse temporal
4. `default` - Warehouse placeholder (sin datos reales)

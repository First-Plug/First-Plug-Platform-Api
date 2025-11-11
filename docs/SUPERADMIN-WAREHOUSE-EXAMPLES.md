# 📦 Ejemplos de Payloads - Warehouse Management

Este documento contiene ejemplos prácticos de requests y responses para los endpoints de warehouse management.

---

## 📝 Tabla de Contenidos

1. [Actualizar Datos del Warehouse](#actualizar-datos-del-warehouse)
2. [Activar Warehouse](#activar-warehouse)
3. [Desactivar Warehouse](#desactivar-warehouse)
4. [Obtener Warehouses](#obtener-warehouses)

---

## 1. Actualizar Datos del Warehouse

### Ejemplo 1: Actualizar Información Completa

**Request:**
```http
PATCH /superadmin/warehouses/Argentina/507f1f77bcf86cd799439011/data
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "Warehouse Buenos Aires Central",
  "address": "Av. Corrientes 1234",
  "apartment": "Piso 5, Oficina 502",
  "city": "Buenos Aires",
  "state": "CABA",
  "zipCode": "C1043",
  "email": "warehouse.ba@firstplug.com",
  "phone": "+54 11 1234-5678",
  "contactPerson": "Juan Pérez",
  "canal": "whatsapp",
  "partnerType": "partner",
  "additionalInfo": "Horario: Lunes a Viernes 9-18hs. Sábados 9-13hs."
}
```

**Response 200 OK:**
```json
{
  "warehouse": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Warehouse Buenos Aires Central",
    "address": "Av. Corrientes 1234",
    "apartment": "Piso 5, Oficina 502",
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
    "additionalInfo": "Horario: Lunes a Viernes 9-18hs. Sábados 9-13hs.",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T15:30:00.000Z"
  },
  "message": "Warehouse updated successfully in Argentina"
}
```

---

### Ejemplo 2: Actualizar Solo Algunos Campos

**Request:**
```http
PATCH /superadmin/warehouses/Brazil/507f1f77bcf86cd799439012/data
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "phone": "+55 11 98765-4321",
  "email": "warehouse.sp@firstplug.com",
  "contactPerson": "Maria Silva"
}
```

**Response 200 OK:**
```json
{
  "warehouse": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Warehouse São Paulo",
    "address": "Av. Paulista 1000",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01310-100",
    "email": "warehouse.sp@firstplug.com",
    "phone": "+55 11 98765-4321",
    "contactPerson": "Maria Silva",
    "canal": "whatsapp",
    "partnerType": "partner",
    "isActive": true,
    "isDeleted": false,
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-20T16:00:00.000Z"
  },
  "message": "Warehouse updated successfully in Brazil"
}
```

---

### Ejemplo 3: Completar Warehouse (Auto-activación)

**Request:**
```http
PATCH /superadmin/warehouses/Chile/507f1f77bcf86cd799439013/data
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "name": "Warehouse Santiago",
  "address": "Av. Libertador Bernardo O'Higgins 1234",
  "city": "Santiago",
  "state": "Región Metropolitana",
  "zipCode": "8320000"
}
```

**Response 200 OK (Auto-activado):**
```json
{
  "warehouse": {
    "_id": "507f1f77bcf86cd799439013",
    "name": "Warehouse Santiago",
    "address": "Av. Libertador Bernardo O'Higgins 1234",
    "city": "Santiago",
    "state": "Región Metropolitana",
    "zipCode": "8320000",
    "canal": "whatsapp",
    "partnerType": "default",
    "isActive": true,
    "isDeleted": false,
    "createdAt": "2024-01-18T10:00:00.000Z",
    "updatedAt": "2024-01-20T16:30:00.000Z"
  },
  "autoActivated": true,
  "message": "Warehouse updated and auto-activated in Chile"
}
```

---

## 2. Activar Warehouse

### Ejemplo 1: Activar Warehouse Exitosamente

**Request:**
```http
PATCH /superadmin/warehouses/Argentina/507f1f77bcf86cd799439014/toggle-active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isActive": true
}
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Warehouse activated successfully in Argentina",
  "warehouse": {
    "_id": "507f1f77bcf86cd799439014",
    "name": "Warehouse Córdoba",
    "address": "Av. Colón 5678",
    "city": "Córdoba",
    "state": "Córdoba",
    "zipCode": "X5000",
    "email": "warehouse.cba@firstplug.com",
    "phone": "+54 351 1234-5678",
    "canal": "slack",
    "partnerType": "own",
    "isActive": true,
    "isDeleted": false,
    "createdAt": "2024-01-12T10:00:00.000Z",
    "updatedAt": "2024-01-20T17:00:00.000Z"
  },
  "deactivatedWarehouses": ["Warehouse Buenos Aires Central"],
  "migratedProducts": 45,
  "affectedTenants": 3
}
```

---

### Ejemplo 2: Intentar Activar Warehouse Incompleto

**Request:**
```http
PATCH /superadmin/warehouses/Mexico/507f1f77bcf86cd799439015/toggle-active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isActive": true
}
```

**Response 400 Bad Request:**
```json
{
  "statusCode": 400,
  "message": "Cannot activate incomplete warehouse. Missing required fields: city, state, zipCode",
  "error": "Bad Request"
}
```

---

### Ejemplo 3: Activar Warehouse que Ya Está Activo

**Request:**
```http
PATCH /superadmin/warehouses/Brazil/507f1f77bcf86cd799439012/toggle-active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isActive": true
}
```

**Response 200 OK:**
```json
{
  "success": false,
  "message": "Warehouse is already active",
  "warehouse": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Warehouse São Paulo",
    "address": "Av. Paulista 1000",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01310-100",
    "isActive": true,
    "isDeleted": false,
    "createdAt": "2024-01-10T10:00:00.000Z",
    "updatedAt": "2024-01-20T16:00:00.000Z"
  }
}
```

---

## 3. Desactivar Warehouse

### Ejemplo 1: Desactivar con Auto-activación de Otro

**Request:**
```http
PATCH /superadmin/warehouses/Argentina/507f1f77bcf86cd799439011/toggle-active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isActive": false
}
```

**Response 200 OK:**
```json
{
  "success": true,
  "message": "Warehouse deactivated successfully in Argentina",
  "warehouse": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Warehouse Buenos Aires Central",
    "address": "Av. Corrientes 1234",
    "city": "Buenos Aires",
    "state": "CABA",
    "zipCode": "C1043",
    "isActive": false,
    "isDeleted": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-20T17:30:00.000Z"
  }
}
```

---

### Ejemplo 2: Desactivar Sin Otro Warehouse Disponible

**Request:**
```http
PATCH /superadmin/warehouses/Peru/507f1f77bcf86cd799439016/toggle-active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "isActive": false
}
```

**Response 200 OK (Con Warning):**
```json
{
  "success": true,
  "message": "Warehouse deactivated successfully in Peru",
  "warehouse": {
    "_id": "507f1f77bcf86cd799439016",
    "name": "Warehouse Lima",
    "address": "Av. Javier Prado 1234",
    "city": "Lima",
    "state": "Lima",
    "zipCode": "15036",
    "isActive": false,
    "isDeleted": false,
    "createdAt": "2024-01-14T10:00:00.000Z",
    "updatedAt": "2024-01-20T18:00:00.000Z"
  },
  "warning": "Warning: Peru now has no active warehouses. Products cannot be assigned to FP warehouse until a warehouse is activated."
}
```

---

## 4. Obtener Warehouses

### Ejemplo 1: Obtener Warehouses de un País

**Request:**
```http
GET /superadmin/warehouses/Argentina
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
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
      "apartment": "Piso 5",
      "city": "Buenos Aires",
      "state": "CABA",
      "zipCode": "C1043",
      "email": "warehouse.ba@firstplug.com",
      "phone": "+54 11 1234-5678",
      "contactPerson": "Juan Pérez",
      "canal": "whatsapp",
      "partnerType": "partner",
      "isActive": true,
      "isDeleted": false,
      "additionalInfo": "Horario: Lunes a Viernes 9-18hs",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-20T15:30:00.000Z"
    },
    {
      "_id": "507f1f77bcf86cd799439014",
      "name": "Warehouse Córdoba",
      "address": "Av. Colón 5678",
      "city": "Córdoba",
      "state": "Córdoba",
      "zipCode": "X5000",
      "email": "warehouse.cba@firstplug.com",
      "phone": "+54 351 1234-5678",
      "canal": "slack",
      "partnerType": "own",
      "isActive": false,
      "isDeleted": false,
      "createdAt": "2024-01-12T10:00:00.000Z",
      "updatedAt": "2024-01-20T17:00:00.000Z"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-20T15:30:00.000Z"
}
```

---

## 🎨 Códigos de Ejemplo para Frontend

### TypeScript Interface

```typescript
interface Warehouse {
  _id: string;
  name: string;
  address: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  canal: 'whatsapp' | 'slack' | 'mail' | 'phone';
  partnerType: 'partner' | 'own' | 'temporary' | 'default';
  isActive: boolean;
  isDeleted: boolean;
  additionalInfo?: string;
  createdAt: string;
  updatedAt: string;
}

interface UpdateWarehouseDataDto {
  name?: string;
  address?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  canal?: 'whatsapp' | 'slack' | 'mail' | 'phone';
  partnerType?: 'partner' | 'own' | 'temporary' | 'default';
  additionalInfo?: string;
}

interface ToggleWarehouseActiveDto {
  isActive: boolean;
}
```

### Función de Validación

```typescript
function isWarehouseComplete(warehouse: Warehouse): boolean {
  const requiredFields: (keyof Warehouse)[] = [
    'name',
    'address',
    'city',
    'state',
    'zipCode'
  ];
  
  return requiredFields.every(field => {
    const value = warehouse[field];
    return value && typeof value === 'string' && value.trim() !== '';
  });
}

function getMissingFields(warehouse: Warehouse): string[] {
  const requiredFields: (keyof Warehouse)[] = [
    'name',
    'address',
    'city',
    'state',
    'zipCode'
  ];
  
  return requiredFields.filter(field => {
    const value = warehouse[field];
    return !value || typeof value !== 'string' || value.trim() === '';
  });
}
```

### Ejemplo de Llamada API

```typescript
// Actualizar datos del warehouse
async function updateWarehouseData(
  country: string,
  warehouseId: string,
  data: UpdateWarehouseDataDto
) {
  const response = await fetch(
    `/superadmin/warehouses/${country}/${warehouseId}/data`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Toggle estado de activación
async function toggleWarehouseActive(
  country: string,
  warehouseId: string,
  isActive: boolean
) {
  const response = await fetch(
    `/superadmin/warehouses/${country}/${warehouseId}/toggle-active`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isActive })
    }
  );
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}
```


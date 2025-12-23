# Quotes GET Endpoint - Paginación y Filtrado

## Overview

El endpoint GET `/quotes` ahora soporta paginación y filtrado por fecha, similar al endpoint de activity/history.

## Endpoint

```
GET /quotes?page=1&size=10&startDate=2025-01-01T00:00:00Z&endDate=2025-01-31T23:59:59Z
```

## Query Parameters

| Parámetro   | Tipo              | Default   | Descripción                         |
| ----------- | ----------------- | --------- | ----------------------------------- |
| `page`      | number            | 1         | Número de página (comienza en 1)    |
| `size`      | number            | 10        | Cantidad de registros por página    |
| `startDate` | string (ISO 8601) | undefined | Fecha inicio (inclusive) - Opcional |
| `endDate`   | string (ISO 8601) | undefined | Fecha fin (inclusive) - Opcional    |

**Nota**: Si NO se envían `startDate` y `endDate`, se retornan TODAS las quotes sin filtro de fecha.

## Response Format

```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "requestId": "REQ-2025-001",
      "tenantId": "507f1f77bcf86cd799439012",
      "tenantName": "acme-corp",
      "userName": "John Doe",
      "userEmail": "john@acme.com",
      "requestType": "Comprar productos",
      "status": "Requested",
      "productCount": 3,
      "totalQuantity": 8,
      "products": [
        {
          "category": "Phone",
          "quantity": 2,
          "country": "US",
          "brand": ["Apple"],
          "model": ["iPhone 15 Pro"],
          "otherSpecifications": "Latest model"
        },
        {
          "category": "Tablet",
          "quantity": 1,
          "country": "US",
          "brand": ["Apple"],
          "model": ["iPad Air 5"],
          "screenSize": ["10.9\""]
        },
        {
          "category": "Furniture",
          "quantity": 5,
          "country": "US",
          "furnitureType": ["Desk"]
        }
      ],
      "isActive": true,
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "totalCount": 25,
  "totalPages": 3
}
```

## Examples

### 1. Obtener primera página (10 registros)

```
GET /quotes?page=1&size=10
```

### 2. Obtener segunda página con 20 registros por página

```
GET /quotes?page=2&size=20
```

### 3. Filtrar por últimos 7 días

```
GET /quotes?page=1&size=10&startDate=2025-01-11T00:00:00Z&endDate=2025-01-18T23:59:59Z
```

### 4. Filtrar por rango personalizado

```
GET /quotes?page=1&size=10&startDate=2025-01-01T00:00:00Z&endDate=2025-01-31T23:59:59Z
```

## Frontend Integration

### Filtros de Tiempo (Sugeridos)

- Últimos 7 días
- Últimos 30 días
- Últimos 90 días
- Personalizado (date picker)

### Tabla Columns

| Columna  | Fuente              | Descripción                                       |
| -------- | ------------------- | ------------------------------------------------- |
| ID       | requestId           | Identificador único del quote                     |
| Type     | products[].category | Tipo de producto (Phone, Tablet, Furniture, etc.) |
| Items    | productCount        | Cantidad de items agregados                       |
| Products | totalQuantity       | Cantidad total de productos                       |
| Created  | createdAt           | Fecha de creación                                 |
| User     | userName            | Quién solicitó el quote                           |
| Status   | status              | Requested o Cancelled                             |
| Actions  | -                   | Edit, Delete, View                                |

## Key Features

✅ **Paginación**: Controla cantidad de registros por página
✅ **Filtrado por Fecha**: Rango personalizable
✅ **Datos Completos**: Incluye todos los detalles de productos (NO requiere GET by ID)
✅ **Metadata**: totalCount y totalPages para UI
✅ **Sorting**: Ordenado por createdAt descendente (más recientes primero)

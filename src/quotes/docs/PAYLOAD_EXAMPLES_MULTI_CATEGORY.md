# Payload Examples - Multi-Category Quotes

## 1. Quote con Monitor

```json
{
  "products": [
    {
      "category": "Monitor",
      "quantity": 2,
      "brand": ["LG", "Dell"],
      "model": ["27UP550", "U2720Q"],
      "screenSize": ["27\"", "27\""],
      "screenTechnology": ["IPS"],
      "otherSpecifications": "USB-C connectivity",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-25",
      "comments": "Necesitamos para la oficina principal"
    }
  ]
}
```

## 2. Quote con Audio

```json
{
  "products": [
    {
      "category": "Audio",
      "quantity": 5,
      "brand": ["Bose", "Sony"],
      "model": ["QuietComfort 45", "WH-1000XM5"],
      "otherSpecifications": "Noise cancelling",
      "country": "AR",
      "city": "CABA",
      "deliveryDate": "2025-12-20",
      "comments": "Para el equipo de desarrollo"
    }
  ]
}
```

## 3. Quote con Peripherals

```json
{
  "products": [
    {
      "category": "Peripherals",
      "quantity": 10,
      "brand": ["Logitech"],
      "model": ["MX Master 3S"],
      "otherSpecifications": "Wireless, multi-device",
      "country": "AR",
      "city": "Rosario",
      "deliveryDate": "2025-12-22",
      "comments": "Mouses para toda la oficina"
    }
  ]
}
```

## 4. Quote con Merchandising

```json
{
  "products": [
    {
      "category": "Merchandising",
      "quantity": 100,
      "description": "Camisetas con logo FirstPlug",
      "additionalRequirements": "Talla M y L, colores azul y blanco",
      "otherSpecifications": "100% algodón, impresión frontal",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2026-01-15",
      "comments": "Para evento de lanzamiento"
    }
  ]
}
```

## 5. Quote con Other

```json
{
  "products": [
    {
      "category": "Other",
      "quantity": 3,
      "brand": ["Generic"],
      "model": ["Desk Lamp"],
      "otherSpecifications": "LED, adjustable brightness",
      "country": "AR",
      "city": "Mendoza",
      "deliveryDate": "2025-12-28",
      "comments": "Lámparas para escritorios"
    }
  ]
}
```

## 6. Quote con Múltiples Categorías (Computer + Monitor + Audio)

```json
{
  "products": [
    {
      "category": "Computer",
      "quantity": 2,
      "os": "Windows",
      "brand": ["Dell"],
      "model": ["XPS 13"],
      "processor": ["Intel i7"],
      "ram": ["16GB"],
      "storage": ["512GB SSD"],
      "screenSize": ["13.3\""],
      "otherSpecifications": "Touchscreen",
      "extendedWarranty": true,
      "extendedWarrantyYears": 2,
      "deviceEnrollment": true,
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-20",
      "comments": "Para nuevos empleados"
    },
    {
      "category": "Monitor",
      "quantity": 2,
      "brand": ["LG"],
      "model": ["27UP550"],
      "screenSize": ["27\""],
      "screenTechnology": ["IPS"],
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-20",
      "comments": "Monitores para los nuevos empleados"
    },
    {
      "category": "Audio",
      "quantity": 2,
      "brand": ["Bose"],
      "model": ["QuietComfort 45"],
      "otherSpecifications": "Noise cancelling",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-20",
      "comments": "Headphones para llamadas"
    }
  ]
}
```

## 7. Quote con Phone

```json
{
  "products": [
    {
      "category": "Phone",
      "quantity": 2,
      "brand": ["Apple", "Samsung"],
      "model": ["iPhone 15", "Galaxy S24"],
      "otherSpecifications": "Need protective cases",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-25"
    }
  ]
}
```

## 8. Quote con Tablet

```json
{
  "products": [
    {
      "category": "Tablet",
      "quantity": 3,
      "brand": ["Apple"],
      "model": ["iPad Pro 11 (M4)"],
      "screenSize": ["11\""],
      "otherSpecifications": "With Apple Pencil and protective case",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-25"
    }
  ]
}
```

## 9. Quote con Furniture

```json
{
  "products": [
    {
      "category": "Furniture",
      "quantity": 5,
      "furnitureType": ["Standing Desk", "Chair"],
      "otherSpecifications": "Ergonomic design preferred, adjustable height",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-25"
    }
  ]
}
```

## 10. Quote con Múltiples Categorías (Phone + Tablet + Furniture)

```json
{
  "products": [
    {
      "category": "Phone",
      "quantity": 2,
      "brand": ["Apple"],
      "model": ["iPhone 15 Pro"],
      "otherSpecifications": "Need protective cases and screen protectors",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-25"
    },
    {
      "category": "Tablet",
      "quantity": 3,
      "brand": ["Apple"],
      "model": ["iPad Pro 11 (M4)"],
      "screenSize": ["11\""],
      "otherSpecifications": "With Apple Pencil Pro",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-25"
    },
    {
      "category": "Furniture",
      "quantity": 5,
      "furnitureType": ["Standing Desk", "Chair"],
      "otherSpecifications": "Ergonomic design, adjustable height for standing desk",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-25"
    }
  ]
}
```

## 11. Quote con IT Support Service (Solo Servicio) - Computer Asus en SG Warehouse

```json
{
  "services": [
    {
      "serviceCategory": "IT Support",
      "productId": "690b9d8e3c2dc7018e2f5036",
      "productSnapshot": {
        "category": "Computer",
        "name": "Computer",
        "brand": "Asus",
        "model": "IdeaPad Serie S",
        "serialNumber": "grupo 6",
        "location": "FP warehouse",
        "assignedTo": "Default Warehouse",
        "countryCode": "SG"
      },
      "issues": ["Device not connecting to network", "Slow performance"],
      "description": "Asus IdeaPad Serie S experiencing connectivity issues and performance degradation. Needs diagnostic and repair.",
      "issueStartDate": "2025-12-15",
      "impactLevel": "high"
    }
  ]
}
```

## 12. Quote con IT Support Service para Member (Solo Servicio) - Audio Sony para Alfredo Rolon

```json
{
  "services": [
    {
      "serviceCategory": "IT Support",
      "productId": "690a4b12672c966f9351fc4f",
      "productSnapshot": {
        "category": "Audio",
        "name": "Audio name",
        "brand": "Sony",
        "model": "Zone Vibe 125",
        "serialNumber": "serialserial1",
        "location": "Employee",
        "assignedTo": "Alfredo Rolon",
        "countryCode": "PY"
      },
      "issues": ["Audio not working", "Microphone not responding"],
      "description": "Sony Zone Vibe 125 assigned to Alfredo Rolon is experiencing hardware issues. Needs immediate attention and repair.",
      "issueStartDate": "2025-12-14",
      "impactLevel": "high"
    }
  ]
}
```

## 13. Quote Mixto: Productos + Servicios

```json
{
  "products": [
    {
      "category": "Computer",
      "quantity": 1,
      "os": "Windows",
      "brand": ["Asus"],
      "model": ["IdeaPad Serie S"],
      "processor": ["AMD Ryzen 7"],
      "ram": ["16GB"],
      "storage": ["512GB SSD"],
      "screenSize": ["15.6\""],
      "otherSpecifications": "FHD Display",
      "extendedWarranty": true,
      "extendedWarrantyYears": 2,
      "deviceEnrollment": true,
      "country": "SG",
      "city": "Singapore",
      "deliveryDate": "2025-12-20",
      "comments": "Para nuevo empleado en SG"
    }
  ],
  "services": [
    {
      "serviceCategory": "IT Support",
      "productId": "690a4b12672c966f9351fc4f",
      "productSnapshot": {
        "category": "Audio",
        "name": "Audio",
        "brand": "Sony",
        "model": "Zone Vibe 125",
        "serialNumber": "serialserial1",
        "location": "Employee",
        "assignedTo": "Alfredo Rolon",
        "countryCode": "PY"
      },
      "issues": ["Audio not working"],
      "description": "Sony Zone Vibe 125 assigned to Alfredo Rolon needs IT support for audio connectivity issues.",
      "issueStartDate": "2025-12-15",
      "impactLevel": "medium"
    }
  ]
}
```

## 14. Quote con Enrollment Service (Enrollar Múltiples Dispositivos)

```json
{
  "services": [
    {
      "serviceCategory": "Enrollment",
      "productIds": ["690b9d8e3c2dc7018e2f5036", "690b9d8e3c2dc7018e2f5037"],
      "enrolledDevices": [
        {
          "category": "Computer",
          "name": "",
          "brand": "Apple",
          "model": "MacBook Pro",
          "serialNumber": "5dys87g1s27",
          "location": "FP warehouse",
          "assignedTo": "Sede FirstPlug P",
          "countryCode": "AR"
        },
        {
          "category": "Computer",
          "name": "",
          "brand": "Apple",
          "model": "ipod",
          "serialNumber": "ipod-serial-001",
          "location": "Our office",
          "assignedTo": "NuevoConShipments",
          "countryCode": "FR"
        }
      ],
      "additionalDetails": "Enroll 2 Mac devices for MDM management. Require Apple Business Manager integration."
    }
  ]
}
```

**Nota:** El servicio de Enrollment permite:

- Enrollar múltiples dispositivos en una sola solicitud
- Guardar IDs de los productos como referencia (`productIds`)
- Capturar snapshots de cada dispositivo (brand, model, serial, location, etc.)
- Agregar detalles adicionales opcionales
- Contar automáticamente dispositivos por tipo (Mac vs Windows)

## Endpoints

### Crear Quote

```
POST /api/quotes
Content-Type: application/json
Authorization: Bearer {token}

{payload}
```

### Cancelar Quote

```
PATCH /api/quotes/:id/cancel
Content-Type: application/json
Authorization: Bearer {token}
```

**Respuesta:**

```json
{
  "id": "67a1b2c3d4e5f6g7h8i9j0k1",
  "tenantName": "firstplug",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "requestType": "mixed",
  "status": "Cancelled",
  "products": [...],
  "services": [...],
  "createdAt": "2025-12-23T10:30:00Z",
  "updatedAt": "2025-12-23T11:45:00Z"
}
```

**Nota:** No requiere payload en el body. Solo cambia el status de "Requested" a "Cancelled" y desencadena:

- Mensaje a Slack informando la cancelación (con icono ❌ y título "Cancelación del pedido de cotización n°: ...")
- History record con oldData (status: Requested) y newData (status: Cancelled)

**Mensaje de Slack para Cancelación:**

```
❌ Cancelación del pedido de cotización n°: QR-mechi_test-000030

Type: Cancelled
Tenant: mechi_test
Request Type: mixed
Products: 2
Services: 1
userName: John Doe
usermail: john@example.com

[Detalles de productos y servicios...]
```

**History Record para Cancelación (GET /history):**

```json
{
  "_id": "67a1b2c3d4e5f6g7h8i9j0k2",
  "actionType": "cancel",
  "userId": "john@example.com",
  "itemType": "quotes",
  "changes": {
    "oldData": {
      "requestId": "QR-mechi_test-000030",
      "tenantName": "mechi_test",
      "userEmail": "john@example.com",
      "userName": "John Doe",
      "requestType": "mixed",
      "status": "Requested",
      "productCount": 2,
      "totalQuantity": 3,
      "products": [...],
      "serviceCount": 1,
      "services": [...]
    },
    "newData": {
      "requestId": "QR-mechi_test-000030",
      "tenantName": "mechi_test",
      "userEmail": "john@example.com",
      "userName": "John Doe",
      "requestType": "mixed",
      "status": "Cancelled",
      "productCount": 2,
      "totalQuantity": 3,
      "products": [...],
      "serviceCount": 1,
      "services": [...]
    }
  },
  "createdAt": "2025-12-23T11:45:00Z",
  "updatedAt": "2025-12-23T11:45:00Z"
}
```

**Nota para el Frontend:**

- Usar `actionType === 'cancel'` para identificar cancelaciones
- Comparar `oldData.status` (Requested) vs `newData.status` (Cancelled)
- Mostrar icono ❌ o color rojo para cancelaciones

## Notas

### Productos

- `quantity` y `country` son **requeridos**

### Servicios

#### IT Support Service

- **Requeridos**: `serviceCategory`, `issues` (array min 1), `description`, `impactLevel`
- **Opcionales**: `productId`, `productSnapshot`, `issueStartDate`
- Soporta un único producto con snapshot

#### Enrollment Service

- **Requeridos**: `serviceCategory`, `enrolledDevices` (array min 1)
- **Opcionales**: `additionalDetails`
- Soporta múltiples dispositivos en `enrolledDevices`
- Cada dispositivo debe tener su `productSnapshot` con datos completos
- En Slack se muestra:
  - Conteo de dispositivos por tipo (Mac vs Windows)
  - Detalles de cada dispositivo enrollado
  - Detalles adicionales si existen

### ProductSnapshot

Incluye identificación completa del producto (importante para history y Slack):

- `category`: Categoría del producto (Computer, Audio, Monitor, etc.) - **IMPORTANTE**
- `name`: Nombre del producto (ej: "Audio", "Computer")
- `brand`: Marca (ej: "Sony", "Asus", "Apple")
- `model`: Modelo (ej: "Zone Vibe 125", "IdeaPad Serie S", "MacBook Pro")
- `serialNumber`: Serial del dispositivo (ej: "serialserial1", "5dys87g1s27")
- `location`: Dónde está (Employee, FP warehouse, Our office)
- `assignedTo`: A quién está asignado (nombre del member, office, o warehouse)
- `countryCode`: Código ISO del país (ej: "PY", "SG", "AR", "FR")

### Otros

- **issueStartDate**: Formato **YYYY-MM-DD** (ej: "2025-12-14") - Se guarda así en BD y se devuelve en GET así. En Slack se muestra como dd/mm/yyyy
- **requestType** se calcula automáticamente:
  - Solo productos → `"product"`
  - Solo servicios → `"service"`
  - Ambos → `"mixed"`
- Puedes mezclar múltiples categorías de productos con múltiples servicios en un mismo quote
- Los datos del snapshot se guardan en la quote y en el activity record para:
  - Auditoría completa
  - Personalización del detail (category + brand + model + serial)
  - Historial de cambios

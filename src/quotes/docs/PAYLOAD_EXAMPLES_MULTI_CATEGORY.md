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

## Endpoint

```
POST /api/quotes
Content-Type: application/json
Authorization: Bearer {token}

{payload}
```

## Notas

- `quantity` es **requerido** en todas las categorías
- `country` es **requerido** en todas las categorías
- `city`, `deliveryDate`, `comments` son **opcionales** en todas las categorías
- Cada categoría tiene sus propios campos específicos
- Puedes mezclar múltiples categorías en un mismo quote


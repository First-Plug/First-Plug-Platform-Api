# Quotes API - Complete Guide

## Overview

The Quotes API allows creating product quotation requests with support for 9 different product categories. Each quote can contain multiple products from different categories.

## Supported Categories

| Category | Fields | Status |
|----------|--------|--------|
| **Computer** | os, brand, model, processor, ram, storage, screenSize, extendedWarranty, deviceEnrollment, otherSpecifications | ✅ |
| **Monitor** | brand, model, screenSize, screenTechnology, otherSpecifications | ✅ |
| **Audio** | brand, model, otherSpecifications | ✅ |
| **Peripherals** | brand, model, otherSpecifications | ✅ |
| **Merchandising** | description, additionalRequirements, otherSpecifications | ✅ |
| **Phone** | brand, model, otherSpecifications | ✅ |
| **Tablet** | brand, model, screenSize, otherSpecifications | ✅ |
| **Furniture** | furnitureType, otherSpecifications | ✅ |
| **Other** | brand, model, otherSpecifications | ✅ |

## Common Fields (All Categories)

- `quantity` - **Required** (positive integer)
- `country` - **Required** (ISO 2-letter code, e.g., "AR")
- `city` - Optional
- `deliveryDate` - Optional (ISO 8601 format)
- `comments` - Optional
- `otherSpecifications` - Optional (text area)

## Payload Examples

### 1. Computer
```json
{
  "products": [{
    "category": "Computer",
    "quantity": 1,
    "os": "Windows",
    "brand": ["Dell"],
    "model": ["XPS 15"],
    "processor": ["Intel Core i7"],
    "ram": ["16GB"],
    "storage": ["512GB"],
    "screenSize": ["15"],
    "extendedWarranty": true,
    "extendedWarrantyYears": 2,
    "deviceEnrollment": false,
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 2. Monitor
```json
{
  "products": [{
    "category": "Monitor",
    "quantity": 2,
    "brand": ["LG"],
    "model": ["UltraWide"],
    "screenSize": ["34"],
    "screenTechnology": "IPS",
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 3. Audio
```json
{
  "products": [{
    "category": "Audio",
    "quantity": 3,
    "brand": ["Sony"],
    "model": ["WH-1000XM5"],
    "otherSpecifications": "Noise cancelling headphones",
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 4. Peripherals
```json
{
  "products": [{
    "category": "Peripherals",
    "quantity": 5,
    "brand": ["Logitech"],
    "model": ["MX Master 3S"],
    "otherSpecifications": "Wireless mouse",
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 5. Merchandising
```json
{
  "products": [{
    "category": "Merchandising",
    "quantity": 100,
    "description": "Company branded t-shirts",
    "additionalRequirements": "Size M and L, logo on front",
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 6. Phone
```json
{
  "products": [{
    "category": "Phone",
    "quantity": 2,
    "brand": ["Apple"],
    "model": ["iPhone 15 Pro"],
    "otherSpecifications": "Need protective cases",
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 7. Tablet
```json
{
  "products": [{
    "category": "Tablet",
    "quantity": 3,
    "brand": ["Apple"],
    "model": ["iPad Pro 11 (M4)"],
    "screenSize": ["11\""],
    "otherSpecifications": "With Apple Pencil Pro",
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 8. Furniture
```json
{
  "products": [{
    "category": "Furniture",
    "quantity": 5,
    "furnitureType": ["Standing Desk", "Chair"],
    "otherSpecifications": "Ergonomic design",
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 9. Other
```json
{
  "products": [{
    "category": "Other",
    "quantity": 10,
    "brand": ["Generic"],
    "model": ["Item"],
    "otherSpecifications": "Custom items",
    "country": "AR",
    "city": "Buenos Aires",
    "deliveryDate": "2025-12-25"
  }]
}
```

### 10. Multiple Categories
```json
{
  "products": [
    {
      "category": "Phone",
      "quantity": 2,
      "brand": ["Apple"],
      "model": ["iPhone 15 Pro"],
      "otherSpecifications": "Need protective cases",
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
      "furnitureType": ["Standing Desk"],
      "otherSpecifications": "Ergonomic design",
      "country": "AR",
      "city": "Buenos Aires",
      "deliveryDate": "2025-12-25"
    }
  ]
}
```

## API Endpoint

```
POST /api/quotes
Content-Type: application/json
Authorization: Bearer {token}
```

## Response

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "requestId": "QR-mechi_test-000001",
  "status": "Requested",
  "products": [...],
  "isDeleted": false,
  "createdAt": "2025-12-17T10:00:00Z",
  "updatedAt": "2025-12-17T10:00:00Z"
}
```

## Notes

- `quantity` and `country` are **required** for all categories
- Each category has its own specific fields
- You can mix multiple categories in a single quote
- Status is automatically set to "Requested" on creation
- Slack notifications are sent automatically


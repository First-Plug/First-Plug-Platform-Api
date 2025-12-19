# History Recording Examples for Quotes

## Overview
When a quote is created, all product data is saved to the history collection with category-specific fields.

## Phone Category Example

### Request Payload
```json
{
  "products": [
    {
      "category": "Phone",
      "quantity": 5,
      "brand": ["Apple", "Samsung"],
      "model": ["iPhone 15", "Galaxy S24"],
      "otherSpecifications": "Need latest models",
      "country": "US",
      "city": "New York",
      "deliveryDate": "2025-01-15",
      "comments": "Urgent delivery needed"
    }
  ]
}
```

### History Record Saved (newData.products[0])
```json
{
  "category": "Phone",
  "quantity": 5,
  "country": "US",
  "city": "New York",
  "deliveryDate": "2025-01-15",
  "comments": "Urgent delivery needed",
  "otherSpecifications": "Need latest models",
  "brand": ["Apple", "Samsung"],
  "model": ["iPhone 15", "Galaxy S24"]
}
```

## Tablet Category Example

### Request Payload
```json
{
  "products": [
    {
      "category": "Tablet",
      "quantity": 3,
      "brand": ["Apple", "Samsung"],
      "model": ["iPad Pro 12.9", "Galaxy Tab S9"],
      "screenSize": ["12.9\"", "11\""],
      "otherSpecifications": "M2 processor preferred",
      "country": "ES",
      "deliveryDate": "2025-02-01"
    }
  ]
}
```

### History Record Saved (newData.products[0])
```json
{
  "category": "Tablet",
  "quantity": 3,
  "country": "ES",
  "deliveryDate": "2025-02-01",
  "otherSpecifications": "M2 processor preferred",
  "brand": ["Apple", "Samsung"],
  "model": ["iPad Pro 12.9", "Galaxy Tab S9"],
  "screenSize": ["12.9\"", "11\""]
}
```

## Furniture Category Example

### Request Payload
```json
{
  "products": [
    {
      "category": "Furniture",
      "quantity": 10,
      "furnitureType": ["Desk", "Chair"],
      "otherSpecifications": "Ergonomic design required",
      "country": "MX",
      "city": "Mexico City",
      "comments": "For new office setup"
    }
  ]
}
```

### History Record Saved (newData.products[0])
```json
{
  "category": "Furniture",
  "quantity": 10,
  "country": "MX",
  "city": "Mexico City",
  "comments": "For new office setup",
  "otherSpecifications": "Ergonomic design required",
  "furnitureType": ["Desk", "Chair"]
}
```

## Multi-Category Quote Example

### Request Payload
```json
{
  "products": [
    {
      "category": "Phone",
      "quantity": 2,
      "brand": ["Apple"],
      "model": ["iPhone 15 Pro"],
      "country": "US"
    },
    {
      "category": "Tablet",
      "quantity": 1,
      "brand": ["Apple"],
      "model": ["iPad Air 5"],
      "screenSize": ["10.9\""],
      "country": "US"
    },
    {
      "category": "Furniture",
      "quantity": 5,
      "furnitureType": ["Desk"],
      "country": "US"
    }
  ]
}
```

### History Record Saved (newData)
```json
{
  "requestId": "REQ-2025-001",
  "tenantName": "acme-corp",
  "userEmail": "user@acme.com",
  "userName": "John Doe",
  "productCount": 3,
  "totalQuantity": 8,
  "products": [
    {
      "category": "Phone",
      "quantity": 2,
      "country": "US",
      "brand": ["Apple"],
      "model": ["iPhone 15 Pro"]
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
  ]
}
```

## Testing Checklist

- [ ] Phone quote creates history with brand and model fields
- [ ] Tablet quote creates history with brand, model, and screenSize fields
- [ ] Furniture quote creates history with furnitureType field
- [ ] Optional fields (city, comments, etc.) are included when provided
- [ ] Multi-category quotes save all products with correct fields
- [ ] GET /history endpoint returns all saved product fields


# Global Product Synchronization

## 📋 Overview

This document describes the global product synchronization system that keeps the `globalProducts` collection in sync with products across all tenant databases.

## 🎯 Purpose

The global product collection serves as a centralized view of all products across all tenants, enabling:
- Cross-tenant analytics and reporting
- SuperAdmin product management
- Centralized search and filtering
- Historical tracking of product movements

## 🏗️ Architecture

### Collections Involved

1. **Tenant Database - `products` collection**
   - Products in "Our office" or "FP warehouse"
   - Not assigned to any member

2. **Tenant Database - `members.products` subdocuments**
   - Products assigned to members (location: "Employee")
   - Embedded in member documents

3. **Global Database - `globalProducts` collection**
   - Centralized view of all products from all tenants
   - Contains both `products` and `members.products`

### Data Flow

```
Tenant DB (products)  ──┐
                        ├──> Global DB (globalProducts)
Tenant DB (members)   ──┘
```

## 📊 Schema

### GlobalProduct Schema

```typescript
{
  // Tenant identification
  tenantId: ObjectId,           // Reference to tenant._id
  tenantName: string,            // Tenant name for easy filtering
  
  // Product identification
  originalProductId: ObjectId,   // Original _id from tenant DB
  sourceCollection: 'products' | 'members',
  
  // Product data (all standard fields)
  name: string,
  category: string,
  status: string,
  location: string,
  // ... other product fields
  
  // Location-specific data
  fpWarehouse?: {                // When location = 'FP warehouse'
    warehouseId: ObjectId,
    warehouseCountryCode: string,
    warehouseName: string,
    assignedAt: Date,
    status: 'STORED' | 'IN_TRANSIT_IN' | 'IN_TRANSIT_OUT'
  },
  
  memberData?: {                 // When location = 'Employee'
    memberId: ObjectId,
    memberEmail: string,
    memberName: string,
    assignedAt: Date
  },
  
  // Metadata
  lastSyncedAt: Date,
  sourceUpdatedAt: Date
}
```

## 🔄 Synchronization Points

### 1. Product Creation
**Trigger:** `ProductsService.create()`
- Creates product in tenant `products` collection
- Syncs to global collection with `sourceCollection: 'products'`

### 2. Product Assignment to Member
**Trigger:** `AssignmentsService.moveToMemberCollection()`
- Moves product from `products` to `members.products`
- Syncs to global collection with:
  - `sourceCollection: 'members'`
  - `location: 'Employee'`
  - `memberData` populated

### 3. Product Return to Warehouse/Office
**Trigger:** `AssignmentsService.moveToProductsCollection()`
- Moves product from `members.products` to `products`
- Syncs to global collection with:
  - `sourceCollection: 'products'`
  - `location: 'FP warehouse' | 'Our office'`
  - `memberData: null` (cleared)
  - `fpWarehouse` populated (if location = 'FP warehouse')
  - `lastAssigned` preserved

### 4. Product Update
**Trigger:** `ProductsService.update()`
- Updates product in tenant database
- Syncs changes to global collection

### 5. Product Deletion
**Trigger:** `ProductsService.softDelete()`
- Marks product as deleted in tenant database
- Marks product as deleted in global collection

## 🏭 Warehouse Assignment Logic

When a product is returned to "FP warehouse", the system automatically assigns it to the appropriate warehouse based on the **member's origin country**:

```typescript
// Priority order for determining origin country:
1. Provided memberEmail (most reliable)
2. product.lastAssigned
3. product.assignedEmail
4. Default to Argentina if none found

// Warehouse assignment:
- Find warehouse by country code (e.g., "BR" for Brazil)
- Use active warehouse if available, otherwise default warehouse
- Create fpWarehouse data with warehouse details
```

## 🔧 Key Implementation Details

### 1. TenantId Resolution

The system handles both string tenantNames and ObjectId tenantIds:

```typescript
// If tenantId is a string (tenantName), resolve to ObjectId
if (typeof params.tenantId === 'string') {
  const tenant = await tenantsCollection.findOne({
    tenantName: params.tenantId,
  });
  resolvedTenantId = tenant._id; // ObjectId
}
```

### 2. Upsert Strategy

The system uses `updateOne` with `upsert: true` to avoid duplicates:

```typescript
await globalProductModel.updateOne(
  {
    tenantId: resolvedTenantId,      // ObjectId
    originalProductId: params.originalProductId,
  },
  { $set: updateData },
  { upsert: true },
);
```

### 3. Field Cleanup

When fields should be removed (e.g., `memberData` when returning to warehouse), the system explicitly sets them to `null`:

```typescript
const updateData = {
  // ... other fields
  fpWarehouse: params.fpWarehouse !== undefined ? params.fpWarehouse : null,
  memberData: params.memberData !== undefined ? params.memberData : null,
};
```

This ensures MongoDB removes the field instead of leaving stale data.

## 🐛 Common Issues and Solutions

### Issue 1: Duplicate Products

**Symptom:** Multiple documents in global collection with same `originalProductId`

**Cause:** 
- Old documents have `tenantId` as String
- New sync uses `tenantId` as ObjectId
- Query doesn't match, creates duplicate

**Solution:**
```bash
npm run cleanup:global-products
```

This script:
1. Finds all duplicate groups
2. Keeps the most recently synced product
3. Converts `tenantId` to ObjectId
4. Deletes older duplicates

### Issue 2: memberData Not Cleared

**Symptom:** Product returned to warehouse still has `memberData`

**Cause:** Passing `undefined` doesn't remove field in MongoDB

**Solution:** Explicitly set to `null` in update data (already implemented)

### Issue 3: Wrong Warehouse Assigned

**Symptom:** Product assigned to Argentina warehouse instead of member's country

**Cause:** Using incorrect email to lookup member country

**Solution:** Pass `member.email` directly to `assignWarehouseIfNeeded()` (already implemented)

## 📝 Best Practices

### 1. Always Sync After Changes

Every operation that modifies a product should sync to global collection:

```typescript
// After creating/updating product
await this.syncProductToGlobal(product, tenantName, sourceCollection, memberData);
```

### 2. Use Correct Source Collection

- `sourceCollection: 'products'` → Product in products collection
- `sourceCollection: 'members'` → Product in members.products

### 3. Populate Location-Specific Data

- If `location = 'Employee'` → Populate `memberData`
- If `location = 'FP warehouse'` → Populate `fpWarehouse`
- Otherwise → Set both to `null`

### 4. Preserve lastAssigned

Always preserve `lastAssigned` when moving products:

```typescript
const updateData = {
  // ... other fields
  lastAssigned: member.email, // Keep track of last assignment
};
```

## 🧪 Testing

### Manual Testing Checklist

1. **Create Product**
   - [ ] Product appears in global collection
   - [ ] `sourceCollection: 'products'`
   - [ ] `tenantId` is ObjectId

2. **Assign to Member**
   - [ ] Product updates in global collection (no duplicate)
   - [ ] `sourceCollection: 'members'`
   - [ ] `memberData` populated
   - [ ] `location: 'Employee'`

3. **Return to FP Warehouse**
   - [ ] Product updates in global collection (no duplicate)
   - [ ] `sourceCollection: 'products'`
   - [ ] `fpWarehouse` populated with correct country
   - [ ] `memberData: null`
   - [ ] `lastAssigned` preserved

4. **Return to Our Office**
   - [ ] Product updates in global collection (no duplicate)
   - [ ] `sourceCollection: 'products'`
   - [ ] `fpWarehouse: null`
   - [ ] `memberData: null`
   - [ ] `lastAssigned` preserved

## 🚀 Maintenance

### Cleanup Script

Run periodically to clean up duplicates:

```bash
npm run cleanup:global-products
```

### Monitoring

Monitor these metrics:
- Total products in global collection
- Duplicate count (should be 0)
- Sync errors in logs
- Products with String tenantId (should be 0)

## 📚 Related Documentation

- [Warehouse Management](./WAREHOUSE-MANAGEMENT.md)
- [Product Assignment Flow](./PRODUCT-ASSIGNMENT.md)
- [Multi-Tenant Architecture](./MULTI-TENANT.md)

